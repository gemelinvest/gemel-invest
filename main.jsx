import { useState } from "react";
import axios from "axios";
import "./App.css";

function App() {
  const [id, setId] = useState("");
  const [result, setResult] = useState(null);

  const validateID = async () => {
    const res = await axios.post("http://localhost:5000/validate-id", { id });
    setResult(res.data.valid ? "ת"ז תקינה" : "ת"ז לא תקינה");
  };

  return (
    <div className="container">
      <h1>GAMAL INVEST CRM</h1>
      <input
        type="text"
        placeholder="הכנס ת"ז"
        value={id}
        onChange={(e) => setId(e.target.value)}
      />
      <button onClick={validateID}>בדוק ת"ז</button>
      {result && <p>{result}</p>}
    </div>
  );
}

export default App;
