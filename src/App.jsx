import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LoginSignup from "./pages/LoginSignup";
import Dashboard from "./pages/Dashboard";
import UniversityPerformance from "./pages/UniversityPerformance";
import SemesterResultsUpload from "./pages/SemesterResultsUpload";

function App() {
  const [isSignup, setIsSignup] = useState(false);

  return (
    <Router>
      <Routes>
        <Route 
          path="/" 
          element={<LoginSignup isSignup={isSignup} setIsSignup={setIsSignup} />} 
        />
        <Route path="/login" element={<LoginSignup isSignup={isSignup} setIsSignup={setIsSignup} />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/university-performance" element={<UniversityPerformance />} />
        <Route path="/semester-results-upload" element={<SemesterResultsUpload />} />
      </Routes>
    </Router>
  );
}

export default App;