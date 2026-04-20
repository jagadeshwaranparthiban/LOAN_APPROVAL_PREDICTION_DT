import { useState } from 'react'
import './App.css'
import LoanPredictor from './components/LoanPredictor'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <LoanPredictor />
    </>
  )
}

export default App
