from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import pandas as pd
import numpy as np
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.tree import DecisionTreeClassifier
import os


app = FastAPI(title="Loan Approval Prediction API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model: DecisionTreeClassifier | None = None


def train_model():
    """
    Replicates the notebook pipeline:
      1. Load raw CSV
      2. Label-encode binary categoricals
      3. One-hot encode Property_Area (drop_first=True → Semiurban + Urban dummies)
      4. Split and train the tuned DecisionTreeClassifier
    """
    csv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "loan_data.csv")
    if not os.path.exists(csv_path):
        raise FileNotFoundError(
            f"loan_data.csv not found at {csv_path}. "
            "Place your training CSV next to main.py before starting the server."
        )

    data = pd.read_csv(csv_path)

    le = LabelEncoder()
    for col in ["Gender", "Married", "Education", "Self_Employed"]:
        data[col] = le.fit_transform(data[col])

    data = pd.get_dummies(data, columns=["Property_Area"], drop_first=True)

    # Ensure both dummy columns exist even if one class is missing in the CSV
    for col in ["Property_Area_Semiurban", "Property_Area_Urban"]:
        if col not in data.columns:
            data[col] = 0

    X = data.drop(columns=["Loan_Status", "Applicant_ID"], axis=1)
    y = data["Loan_Status"]

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
    return clf


@app.on_event("startup")
def startup_event():
    global model
    try:
        model = train_model()
        print("✅  Model trained successfully.")
    except FileNotFoundError as e:
        print(f"⚠️  {e}")
        print("   The /predict endpoint will return 503 until the CSV is provided.")


class LoanInput(BaseModel):
    gender: str = Field(..., examples=["Male"])           # "Male" | "Female"
    married: str = Field(..., examples=["Yes"])           # "Yes" | "No"
    dependents: int = Field(..., ge=0, le=5, examples=[0])
    education: str = Field(..., examples=["Graduate"])    # "Graduate" | "Not Graduate"
    self_employed: str = Field(..., examples=["No"])      # "Yes" | "No"
    applicant_income: float = Field(..., gt=0, examples=[5500])
    coapplicant_income: float = Field(..., ge=0, examples=[1500])
    loan_amount: float = Field(..., gt=0, examples=[150])        # in thousands
    loan_amount_term: float = Field(..., gt=0, examples=[360])   # in months
    credit_history: int = Field(..., ge=0, le=1, examples=[1])   # 1 = good, 0 = bad
    employment_length: int = Field(..., ge=0, examples=[6])      # years
    age: int = Field(..., ge=18, examples=[32])
    property_area: str = Field(..., examples=["Urban"])  # "Urban" | "Semiurban" | "Rural"


class PredictionResponse(BaseModel):
    approved: bool
    label: str          # "Approved" | "Rejected"
    confidence: float   # probability of the predicted class (0–1)


GENDER_MAP = {"Male": 1, "Female": 0}
MARRIED_MAP = {"Yes": 1, "No": 0}
EDUCATION_MAP = {"Graduate": 1, "Not Graduate": 0}
SELF_EMP_MAP = {"Yes": 1, "No": 0}


def build_feature_row(inp: LoanInput) -> pd.DataFrame:
    return pd.DataFrame([{
        "Gender": GENDER_MAP.get(inp.gender, 1),
        "Married": MARRIED_MAP.get(inp.married, 0),
        "Dependents": inp.dependents,
        "Education": EDUCATION_MAP.get(inp.education, 1),
        "Self_Employed": SELF_EMP_MAP.get(inp.self_employed, 0),
        "ApplicantIncome": inp.applicant_income,
        "CoapplicantIncome": inp.coapplicant_income,
        "LoanAmount": inp.loan_amount,
        "Loan_Amount_Term": inp.loan_amount_term,
        "Credit_History": inp.credit_history,
        "Employment_Length": inp.employment_length,
        "Age": inp.age,
        "Property_Area_Semiurban": 1 if inp.property_area == "Semiurban" else 0,
        "Property_Area_Urban": 1 if inp.property_area == "Urban" else 0,
    }])


@app.get("/health")
def health():
    return {"status": "ok", "model_ready": model is not None}


@app.post("/predict", response_model=PredictionResponse)
def predict(inp: LoanInput):
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded — ensure loan_data.csv exists.")

    row = build_feature_row(inp)

    prediction = model.predict(row)[0]
    probabilities = model.predict_proba(row)[0]  # [P(rejected), P(approved)]
    approved = bool(prediction == 1)
    confidence = float(probabilities[1] if approved else probabilities[0])

    return PredictionResponse(
        approved=approved,
        label="Approved" if approved else "Rejected",
        confidence=round(confidence, 4),
    )