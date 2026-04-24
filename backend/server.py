from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import pandas as pd
from sklearn.preprocessing import LabelEncoder
from sklearn.impute import SimpleImputer
from sklearn.model_selection import train_test_split
from sklearn.tree import DecisionTreeClassifier
import os


app = FastAPI(title="Loan Approval Prediction API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model: DecisionTreeClassifier | None = None
feature_columns: list[str] = []


def train_model():
    csv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "loan_approval_dataset.csv")
    if not os.path.exists(csv_path):
        raise FileNotFoundError(
            f"loan_approval_dataset.csv not found at {csv_path}. "
            "Place your training CSV next to main.py before starting the server."
        )

    data = pd.read_csv(csv_path)

    # Drop ID, encode target
    data = data.drop(columns=["loan_id"])
    data["loan_status"] = data["loan_status"].map({"Approved": 1, "Rejected": 0})

    # Label-encode categoricals
    le = LabelEncoder()
    for col in ["gender", "education", "employment_status", "property_area"]:
        data[col] = le.fit_transform(data[col])

    # Impute missing values
    imputer = SimpleImputer(strategy="median")
    data[data.columns] = imputer.fit_transform(data)

    X = data.drop(columns=["loan_status"])
    y = data["loan_status"]

    X_train, _, y_train, _ = train_test_split(
        X, y, test_size=0.2, random_state=45, stratify=y
    )

    clf = DecisionTreeClassifier(
        max_depth=7,
        min_samples_split=75,
        min_samples_leaf=40,
        random_state=45,
    )
    clf.fit(X_train, y_train)
    return clf, X.columns.tolist()


@app.on_event("startup")
def startup_event():
    global model, feature_columns
    try:
        model, feature_columns = train_model()
        print("✅  Model trained successfully.")
        print(f"   Features: {feature_columns}")
    except FileNotFoundError as e:
        print(f"⚠️  {e}")


# Encoding maps (must match LabelEncoder's alphabetical ordering)
GENDER_MAP          = {"Female": 0, "Male": 1}
EDUCATION_MAP       = {"Graduate": 0, "Not Graduate": 1}
EMPLOYMENT_MAP      = {"Business": 0, "Salaried": 1, "Self-Employed": 2, "Unemployed": 3}
PROPERTY_AREA_MAP   = {"Rural": 0, "Semiurban": 1, "Urban": 2}


class LoanInput(BaseModel):
    age: int                    = Field(..., ge=18, le=70,  examples=[32])
    gender: str                 = Field(...,                examples=["Male"])
    education: str              = Field(...,                examples=["Graduate"])
    employment_status: str      = Field(...,                examples=["Salaried"])
    employment_years: int       = Field(..., ge=0,          examples=[6])
    dependents: int             = Field(..., ge=0, le=5,    examples=[2])
    applicant_income: float     = Field(..., gt=0,          examples=[45000])
    coapplicant_income: float   = Field(..., ge=0,          examples=[15000])
    loan_amount: float          = Field(..., gt=0,          examples=[200000])
    loan_term_months: int       = Field(..., gt=0,          examples=[360])
    credit_score: int           = Field(..., ge=300, le=850,examples=[700])
    existing_emis: int          = Field(..., ge=0,          examples=[1])
    monthly_obligations: float  = Field(..., ge=0,          examples=[5000])
    collateral_value: float     = Field(..., ge=0,          examples=[250000])
    property_area: str          = Field(...,                examples=["Urban"])


class PredictionResponse(BaseModel):
    approved: bool
    label: str
    confidence: float


def build_feature_row(inp: LoanInput) -> pd.DataFrame:
    total_income  = inp.applicant_income + inp.coapplicant_income
    dti_ratio     = round(
        (inp.monthly_obligations + (inp.loan_amount / inp.loan_term_months)) / (total_income / 12), 4
    ) if total_income > 0 else 0
    loan_to_value = round(inp.loan_amount / inp.collateral_value, 4) if inp.collateral_value > 0 else 0

    return pd.DataFrame([{
        "age":                  inp.age,
        "gender":               GENDER_MAP.get(inp.gender, 1),
        "education":            EDUCATION_MAP.get(inp.education, 0),
        "employment_status":    EMPLOYMENT_MAP.get(inp.employment_status, 1),
        "employment_years":     inp.employment_years,
        "dependents":           inp.dependents,
        "applicant_income":     inp.applicant_income,
        "coapplicant_income":   inp.coapplicant_income,
        "total_income":         total_income,
        "loan_amount":          inp.loan_amount,
        "loan_term_months":     inp.loan_term_months,
        "credit_score":         inp.credit_score,
        "existing_emis":        inp.existing_emis,
        "monthly_obligations":  inp.monthly_obligations,
        "dti_ratio":            dti_ratio,
        "collateral_value":     inp.collateral_value,
        "loan_to_value":        loan_to_value,
        "property_area":        PROPERTY_AREA_MAP.get(inp.property_area, 2),
    }])


@app.get("/health")
def health():
    return {"status": "ok", "model_ready": model is not None}


@app.post("/predict", response_model=PredictionResponse)
def predict(inp: LoanInput):
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded — ensure loan_approval_dataset.csv exists.")

    row = build_feature_row(inp)
    prediction    = model.predict(row)[0]
    probabilities = model.predict_proba(row)[0]
    approved      = bool(prediction == 1)
    confidence    = float(probabilities[1] if approved else probabilities[0])

    return PredictionResponse(
        approved=approved,
        label="Approved" if approved else "Rejected",
        confidence=round(confidence, 4),
    )