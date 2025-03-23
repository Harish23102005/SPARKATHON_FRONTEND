import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./SemesterResultsUpload.css";

const SemesterResultsUpload = () => {
  const navigate = useNavigate();
  const [internalFile, setInternalFile] = useState(null);
  const [assignmentFile, setAssignmentFile] = useState(null);
  const [classTestFile, setClassTestFile] = useState(null);
  const [semesterFile, setSemesterFile] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Helper function to safely format values
  const formatValue = (value) => {
    if (value === "-") {
      return "-";
    }
    const num = Number(value);
    if (!isNaN(num)) {
      return num.toFixed(2);
    }
    return "0.00";
  };

  // Function to map percentage to CO level (1 to 3) - must match backend logic
  const mapPercentageToLevel = (percentage) => {
    if (percentage >= 70) return 3; // Level 3 for ≥ 70%
    if (percentage >= 60) return 2; // Level 2 for ≥ 60%
    return 1; // Level 1 for < 60%
  };

  const handleFileChange = (e, setFile) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!internalFile || !assignmentFile || !classTestFile || !semesterFile) {
      setError("Please upload all required files.");
      return;
    }

    const formData = new FormData();
    formData.append("internal", internalFile);
    formData.append("assignment", assignmentFile);
    formData.append("classTest", classTestFile);
    formData.append("semester", semesterFile);

    const token = localStorage.getItem("token");
    const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const response = await axios.post(
        `${baseUrl}/api/students/upload-semester-results`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${token}`,
          },
          timeout: 60000, // 60 seconds timeout
        }
      );
      setResults(response.data);
    } catch (err) {
      console.error("Error uploading semester results:", err);
      setError(err.response?.data?.error || "An error occurred while uploading.");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="semester-results-upload-container">
      <div className="semester-header">
        <button className="back-btn" onClick={() => navigate("/dashboard")}>
          ← Back to Dashboard
        </button>
        <h2>UPLOAD SEMESTER RESULTS</h2>
        <button className="print-btn" onClick={handlePrint}>
          📄 Print Report
        </button>
      </div>

      <div className="file-upload-section">
        <div className="file-input">
          <label>Internal File:</label>
          <input
            type="file"
            accept=".xlsx"
            onChange={(e) => handleFileChange(e, setInternalFile)}
            disabled={loading}
          />
        </div>
        <div className="file-input">
          <label>Assignment File:</label>
          <input
            type="file"
            accept=".xlsx"
            onChange={(e) => handleFileChange(e, setAssignmentFile)}
            disabled={loading}
          />
        </div>
        <div className="file-input">
          <label>Class Test/Tutorial File:</label>
          <input
            type="file"
            accept=".xlsx"
            onChange={(e) => handleFileChange(e, setClassTestFile)}
            disabled={loading}
          />
        </div>
        <div className="file-input">
          <label>Semester Results File:</label>
          <input
            type="file"
            accept=".xlsx"
            onChange={(e) => handleFileChange(e, setSemesterFile)}
            disabled={loading}
          />
        </div>
        <button className="upload-btn" onClick={handleUpload} disabled={loading}>
          {loading ? "Uploading..." : "📤 Upload Results"}
        </button>
      </div>

      {error && (
        <div className="error-section">
          <p>{error}</p>
        </div>
      )}

      {results && (
        <div className="results-section">
          {/* Attainment Procedure Section */}
          <div className="attainment-procedure">
            <h3>Attainment Procedure</h3>
            <table className="attainment-procedure-table">
              <tbody>
                <tr>
                  <td>Attainment %age of Max</td>
                  <td>66</td>
                </tr>
                <tr>
                  <td>Attain. LEVEL 3</td>
                  <td>≥ {results.parameters?.levelThresholds?.level3}%</td>
                </tr>
                <tr>
                  <td>Attain. LEVEL 2</td>
                  <td>≥ {results.parameters?.levelThresholds?.level2}%</td>
                </tr>
                <tr>
                  <td>Attain. LEVEL 1</td>
                  <td>&lt; {results.parameters?.levelThresholds?.level2}%</td>
                </tr>
                <tr>
                  <td>Attainment Level when ≥60% of Students Score more than {results.parameters?.studentScoreTarget}%</td>
                  <td>{mapPercentageToLevel(60)}</td>
                </tr>
                <tr>
                  <td>Attainment Level when ≥70% of Students Score more than {results.parameters?.studentScoreTarget}%</td>
                  <td>{mapPercentageToLevel(70)}</td>
                </tr>
                <tr className="highlight">
                  <td>Target Attainment Levels for the COs</td>
                  <td>{results.parameters?.targetAttainmentLevel}</td>
                  <td>{results.parameters?.targetAttainmentLevel}</td>
                  <td>{results.parameters?.targetAttainmentLevel}</td>
                  <td>{results.parameters?.targetAttainmentLevel}</td>
                  <td>{results.parameters?.targetAttainmentLevel}</td>
                  <td>{results.parameters?.targetAttainmentLevel}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Computation of CO Direct Attainment */}
          <h3>Computation of CO Direct Attainment</h3>
          <table className="results-table">
            <thead>
              <tr>
                <th>Assessment Tools</th>
                <th>CO1</th>
                <th>CO2</th>
                <th>CO3</th>
                <th>CO4</th>
                <th>CO5</th>
                <th>CO6</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Internal Assessment 1</td>
                <td>{formatValue(results.coAttainment?.internal1?.CO1)}</td>
                <td>{formatValue(results.coAttainment?.internal1?.CO2)}</td>
                <td>{formatValue(results.coAttainment?.internal1?.CO3)}</td>
                <td>{formatValue(results.coAttainment?.internal1?.CO4)}</td>
                <td>{formatValue(results.coAttainment?.internal1?.CO5)}</td>
                <td>{formatValue(results.coAttainment?.internal1?.CO6)}</td>
              </tr>
              <tr>
                <td>Internal Assessment 2</td>
                <td>{formatValue(results.coAttainment?.internal2?.CO1)}</td>
                <td>{formatValue(results.coAttainment?.internal2?.CO2)}</td>
                <td>{formatValue(results.coAttainment?.internal2?.CO3)}</td>
                <td>{formatValue(results.coAttainment?.internal2?.CO4)}</td>
                <td>{formatValue(results.coAttainment?.internal2?.CO5)}</td>
                <td>{formatValue(results.coAttainment?.internal2?.CO6)}</td>
              </tr>
              <tr>
                <td>Internal Assessment 3</td>
                <td>{formatValue(results.coAttainment?.internal3?.CO1)}</td>
                <td>{formatValue(results.coAttainment?.internal3?.CO2)}</td>
                <td>{formatValue(results.coAttainment?.internal3?.CO3)}</td>
                <td>{formatValue(results.coAttainment?.internal3?.CO4)}</td>
                <td>{formatValue(results.coAttainment?.internal3?.CO5)}</td>
                <td>{formatValue(results.coAttainment?.internal3?.CO6)}</td>
              </tr>
              <tr className="highlight">
                <td>AVG-Internal Attainment</td>
                <td>{formatValue(results.coAttainment?.internalAvg?.CO1)}</td>
                <td>{formatValue(results.coAttainment?.internalAvg?.CO2)}</td>
                <td>{formatValue(results.coAttainment?.internalAvg?.CO3)}</td>
                <td>{formatValue(results.coAttainment?.internalAvg?.CO4)}</td>
                <td>{formatValue(results.coAttainment?.internalAvg?.CO5)}</td>
                <td>{formatValue(results.coAttainment?.internalAvg?.CO6)}</td>
              </tr>
              <tr>
                <td>Assignment 1</td>
                <td>{formatValue(results.coAttainment?.assignment1?.CO1)}</td>
                <td>{formatValue(results.coAttainment?.assignment1?.CO2)}</td>
                <td>{formatValue(results.coAttainment?.assignment1?.CO3)}</td>
                <td>{formatValue(results.coAttainment?.assignment1?.CO4)}</td>
                <td>{formatValue(results.coAttainment?.assignment1?.CO5)}</td>
                <td>{formatValue(results.coAttainment?.assignment1?.CO6)}</td>
              </tr>
              <tr>
                <td>Assignment 2</td>
                <td>{formatValue(results.coAttainment?.assignment2?.CO1)}</td>
                <td>{formatValue(results.coAttainment?.assignment2?.CO2)}</td>
                <td>{formatValue(results.coAttainment?.assignment2?.CO3)}</td>
                <td>{formatValue(results.coAttainment?.assignment2?.CO4)}</td>
                <td>{formatValue(results.coAttainment?.assignment2?.CO5)}</td>
                <td>{formatValue(results.coAttainment?.assignment2?.CO6)}</td>
              </tr>
              <tr>
                <td>Assignment 3</td>
                <td>{formatValue(results.coAttainment?.assignment3?.CO1)}</td>
                <td>{formatValue(results.coAttainment?.assignment3?.CO2)}</td>
                <td>{formatValue(results.coAttainment?.assignment3?.CO3)}</td>
                <td>{formatValue(results.coAttainment?.assignment3?.CO4)}</td>
                <td>{formatValue(results.coAttainment?.assignment3?.CO5)}</td>
                <td>{formatValue(results.coAttainment?.assignment3?.CO6)}</td>
              </tr>
              <tr className="highlight">
                <td>AVG-Assignment Attainment</td>
                <td>{formatValue(results.coAttainment?.assignmentAvg?.CO1)}</td>
                <td>{formatValue(results.coAttainment?.assignmentAvg?.CO2)}</td>
                <td>{formatValue(results.coAttainment?.assignmentAvg?.CO3)}</td>
                <td>{formatValue(results.coAttainment?.assignmentAvg?.CO4)}</td>
                <td>{formatValue(results.coAttainment?.assignmentAvg?.CO5)}</td>
                <td>{formatValue(results.coAttainment?.assignmentAvg?.CO6)}</td>
              </tr>
              <tr>
                <td>Class Test/Tutorial 1</td>
                <td>{formatValue(results.coAttainment?.classTest1?.CO1)}</td>
                <td>{formatValue(results.coAttainment?.classTest1?.CO2)}</td>
                <td>{formatValue(results.coAttainment?.classTest1?.CO3)}</td>
                <td>{formatValue(results.coAttainment?.classTest1?.CO4)}</td>
                <td>{formatValue(results.coAttainment?.classTest1?.CO5)}</td>
                <td>{formatValue(results.coAttainment?.classTest1?.CO6)}</td>
              </tr>
              <tr>
                <td>Class Test/Tutorial 2</td>
                <td>{formatValue(results.coAttainment?.classTest2?.CO1)}</td>
                <td>{formatValue(results.coAttainment?.classTest2?.CO2)}</td>
                <td>{formatValue(results.coAttainment?.classTest2?.CO3)}</td>
                <td>{formatValue(results.coAttainment?.classTest2?.CO4)}</td>
                <td>{formatValue(results.coAttainment?.classTest2?.CO5)}</td>
                <td>{formatValue(results.coAttainment?.classTest2?.CO6)}</td>
              </tr>
              <tr className="highlight">
                <td>AVG-Class Test/Tutorial</td>
                <td>{formatValue(results.coAttainment?.classTestAvg?.CO1)}</td>
                <td>{formatValue(results.coAttainment?.classTestAvg?.CO2)}</td>
                <td>{formatValue(results.coAttainment?.classTestAvg?.CO3)}</td>
                <td>{formatValue(results.coAttainment?.classTestAvg?.CO4)}</td>
                <td>{formatValue(results.coAttainment?.classTestAvg?.CO5)}</td>
                <td>{formatValue(results.coAttainment?.classTestAvg?.CO6)}</td>
              </tr>
              <tr>
                <td>Seminar</td>
                <td>{formatValue(results.coAttainment?.seminar?.CO1)}</td>
                <td>{formatValue(results.coAttainment?.seminar?.CO2)}</td>
                <td>{formatValue(results.coAttainment?.seminar?.CO3)}</td>
                <td>{formatValue(results.coAttainment?.seminar?.CO4)}</td>
                <td>{formatValue(results.coAttainment?.seminar?.CO5)}</td>
                <td>{formatValue(results.coAttainment?.seminar?.CO6)}</td>
              </tr>
              <tr>
                <td>Work Project/Extra Curricular</td>
                <td>{formatValue(results.coAttainment?.workProject?.CO1)}</td>
                <td>{formatValue(results.coAttainment?.workProject?.CO2)}</td>
                <td>{formatValue(results.coAttainment?.workProject?.CO3)}</td>
                <td>{formatValue(results.coAttainment?.workProject?.CO4)}</td>
                <td>{formatValue(results.coAttainment?.workProject?.CO5)}</td>
                <td>{formatValue(results.coAttainment?.workProject?.CO6)}</td>
              </tr>
              <tr className="highlight">
                <td>IS CO-LEVEL ATTAINED? Internal</td>
                <td className={results.targetAttained?.CO1 ? "yes" : "no"}>
                  {results.targetAttained?.CO1 ? "YES" : "NO"}
                </td>
                <td className={results.targetAttained?.CO2 ? "yes" : "no"}>
                  {results.targetAttained?.CO2 ? "YES" : "NO"}
                </td>
                <td className={results.targetAttained?.CO3 ? "yes" : "no"}>
                  {results.targetAttained?.CO3 ? "YES" : "NO"}
                </td>
                <td className={results.targetAttained?.CO4 ? "yes" : "no"}>
                  {results.targetAttained?.CO4 ? "YES" : "NO"}
                </td>
                <td className={results.targetAttained?.CO5 ? "yes" : "no"}>
                  {results.targetAttained?.CO5 ? "YES" : "NO"}
                </td>
                <td className={results.targetAttained?.CO6 ? "yes" : "no"}>
                  {results.targetAttained?.CO6 ? "YES" : "NO"}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Total CO Attainment */}
          <h3>Total CO Attainment</h3>
          <table className="results-table">
            <thead>
              <tr>
                <th></th>
                <th>CO1</th>
                <th>CO2</th>
                <th>CO3</th>
                <th>CO4</th>
                <th>CO5</th>
                <th>CO6</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>DIRECT ATTAINMENT = x * External Attainment + y * Internal Attainment</td>
                <td>x = {results.parameters?.x}</td>
                <td>y = {results.parameters?.y}</td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
              </tr>
              <tr>
                <td>Internal Attainment Levels</td>
                <td>{formatValue(results.coAttainment?.cia?.CO1)}</td>
                <td>{formatValue(results.coAttainment?.cia?.CO2)}</td>
                <td>{formatValue(results.coAttainment?.cia?.CO3)}</td>
                <td>{formatValue(results.coAttainment?.cia?.CO4)}</td>
                <td>{formatValue(results.coAttainment?.cia?.CO5)}</td>
                <td>{formatValue(results.coAttainment?.cia?.CO6)}</td>
              </tr>
              <tr>
                <td>External Attainment Level</td>
                <td>{formatValue(results.coAttainment?.see?.CO1)}</td>
                <td>{formatValue(results.coAttainment?.see?.CO2)}</td>
                <td>{formatValue(results.coAttainment?.see?.CO3)}</td>
                <td>{formatValue(results.coAttainment?.see?.CO4)}</td>
                <td>{formatValue(results.coAttainment?.see?.CO5)}</td>
                <td>{formatValue(results.coAttainment?.see?.CO6)}</td>
              </tr>
              <tr>
                <td>Direct Attainment Level</td>
                <td>{formatValue(results.coAttainment?.direct?.CO1)}</td>
                <td>{formatValue(results.coAttainment?.direct?.CO2)}</td>
                <td>{formatValue(results.coAttainment?.direct?.CO3)}</td>
                <td>{formatValue(results.coAttainment?.direct?.CO4)}</td>
                <td>{formatValue(results.coAttainment?.direct?.CO5)}</td>
                <td>{formatValue(results.coAttainment?.direct?.CO6)}</td>
              </tr>
              <tr>
                <td>INDIRECT ATTAINMENT LEVEL</td>
                <td>{formatValue(results.coAttainment?.indirect?.CO1)}</td>
                <td>{formatValue(results.coAttainment?.indirect?.CO2)}</td>
                <td>{formatValue(results.coAttainment?.indirect?.CO3)}</td>
                <td>{formatValue(results.coAttainment?.indirect?.CO4)}</td>
                <td>{formatValue(results.coAttainment?.indirect?.CO5)}</td>
                <td>{formatValue(results.coAttainment?.indirect?.CO6)}</td>
              </tr>
              <tr>
                <td>u</td>
                <td>{results.parameters?.u}</td>
                <td>{results.parameters?.u}</td>
                <td>{results.parameters?.u}</td>
                <td>{results.parameters?.u}</td>
                <td>{results.parameters?.u}</td>
                <td>{results.parameters?.u}</td>
              </tr>
              <tr>
                <td>v</td>
                <td>{results.parameters?.v}</td>
                <td>{results.parameters?.v}</td>
                <td>{results.parameters?.v}</td>
                <td>{results.parameters?.v}</td>
                <td>{results.parameters?.v}</td>
                <td>{results.parameters?.v}</td>
              </tr>
              <tr className="highlight">
                <td>FINAL CO Attainment = u * Direct Attainment + v * Indirect Attainment</td>
                <td>{formatValue(results.coAttainment?.overall?.CO1)}</td>
                <td>{formatValue(results.coAttainment?.overall?.CO2)}</td>
                <td>{formatValue(results.coAttainment?.overall?.CO3)}</td>
                <td>{formatValue(results.coAttainment?.overall?.CO4)}</td>
                <td>{formatValue(results.coAttainment?.overall?.CO5)}</td>
                <td>{formatValue(results.coAttainment?.overall?.CO6)}</td>
              </tr>
              <tr className="highlight">
                <td>IS CO-Target Attained?</td>
                <td className={results.targetAttained?.CO1 ? "yes" : "no"}>
                  {results.targetAttained?.CO1 ? "YES" : "NO"}
                </td>
                <td className={results.targetAttained?.CO2 ? "yes" : "no"}>
                  {results.targetAttained?.CO2 ? "YES" : "NO"}
                </td>
                <td className={results.targetAttained?.CO3 ? "yes" : "no"}>
                  {results.targetAttained?.CO3 ? "YES" : "NO"}
                </td>
                <td className={results.targetAttained?.CO4 ? "yes" : "no"}>
                  {results.targetAttained?.CO4 ? "YES" : "NO"}
                </td>
                <td className={results.targetAttained?.CO5 ? "yes" : "no"}>
                  {results.targetAttained?.CO5 ? "YES" : "NO"}
                </td>
                <td className={results.targetAttained?.CO6 ? "yes" : "no"}>
                  {results.targetAttained?.CO6 ? "YES" : "NO"}
                </td>
              </tr>
              <tr>
                <td>Target Attainment Levels</td>
                <td>{results.parameters?.targetAttainmentLevel}</td>
                <td>{results.parameters?.targetAttainmentLevel}</td>
                <td>{results.parameters?.targetAttainmentLevel}</td>
                <td>{results.parameters?.targetAttainmentLevel}</td>
                <td>{results.parameters?.targetAttainmentLevel}</td>
                <td>{results.parameters?.targetAttainmentLevel}</td>
              </tr>
            </tbody>
          </table>

          {/* Final Internal Course Outcome Analysis */}
          <h3>Final Internal Course Outcome Analysis</h3>
          <table className="results-table">
            <thead>
              <tr>
                <th>Tools</th>
                <th>CO1</th>
                <th>CO2</th>
                <th>CO3</th>
                <th>CO4</th>
                <th>CO5</th>
                <th>CO6</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Internal Assessment 1</td>
                <td>{formatValue(results.coAttainment?.internal1?.CO1)}</td>
                <td>{formatValue(results.coAttainment?.internal1?.CO2)}</td>
                <td>{formatValue(results.coAttainment?.internal1?.CO3)}</td>
                <td>{formatValue(results.coAttainment?.internal1?.CO4)}</td>
                <td>{formatValue(results.coAttainment?.internal1?.CO5)}</td>
                <td>{formatValue(results.coAttainment?.internal1?.CO6)}</td>
              </tr>
              <tr>
                <td>Internal Assessment 2</td>
                <td>{formatValue(results.coAttainment?.internal2?.CO1)}</td>
                <td>{formatValue(results.coAttainment?.internal2?.CO2)}</td>
                <td>{formatValue(results.coAttainment?.internal2?.CO3)}</td>
                <td>{formatValue(results.coAttainment?.internal2?.CO4)}</td>
                <td>{formatValue(results.coAttainment?.internal2?.CO5)}</td>
                <td>{formatValue(results.coAttainment?.internal2?.CO6)}</td>
              </tr>
              <tr>
                <td>Internal Assessment 3</td>
                <td>{formatValue(results.coAttainment?.internal3?.CO1)}</td>
                <td>{formatValue(results.coAttainment?.internal3?.CO2)}</td>
                <td>{formatValue(results.coAttainment?.internal3?.CO3)}</td>
                <td>{formatValue(results.coAttainment?.internal3?.CO4)}</td>
                <td>{formatValue(results.coAttainment?.internal3?.CO5)}</td>
                <td>{formatValue(results.coAttainment?.internal3?.CO6)}</td>
              </tr>
              <tr className="highlight">
                <td>AVG-Internal Attainment</td>
                <td>{formatValue(results.coAttainment?.internalAvg?.CO1)}</td>
                <td>{formatValue(results.coAttainment?.internalAvg?.CO2)}</td>
                <td>{formatValue(results.coAttainment?.internalAvg?.CO3)}</td>
                <td>{formatValue(results.coAttainment?.internalAvg?.CO4)}</td>
                <td>{formatValue(results.coAttainment?.internalAvg?.CO5)}</td>
                <td>{formatValue(results.coAttainment?.internalAvg?.CO6)}</td>
              </tr>
              <tr>
                <td>Assignment 1</td>
                <td>{formatValue(results.coAttainment?.assignment1?.CO1)}</td>
                <td>{formatValue(results.coAttainment?.assignment1?.CO2)}</td>
                <td>{formatValue(results.coAttainment?.assignment1?.CO3)}</td>
                <td>{formatValue(results.coAttainment?.assignment1?.CO4)}</td>
                <td>{formatValue(results.coAttainment?.assignment1?.CO5)}</td>
                <td>{formatValue(results.coAttainment?.assignment1?.CO6)}</td>
              </tr>
              <tr>
                <td>Assignment 2</td>
                <td>{formatValue(results.coAttainment?.assignment2?.CO1)}</td>
                <td>{formatValue(results.coAttainment?.assignment2?.CO2)}</td>
                <td>{formatValue(results.coAttainment?.assignment2?.CO3)}</td>
                <td>{formatValue(results.coAttainment?.assignment2?.CO4)}</td>
                <td>{formatValue(results.coAttainment?.assignment2?.CO5)}</td>
                <td>{formatValue(results.coAttainment?.assignment2?.CO6)}</td>
              </tr>
              <tr>
                <td>Assignment 3</td>
                <td>{formatValue(results.coAttainment?.assignment3?.CO1)}</td>
                <td>{formatValue(results.coAttainment?.assignment3?.CO2)}</td>
                <td>{formatValue(results.coAttainment?.assignment3?.CO3)}</td>
                <td>{formatValue(results.coAttainment?.assignment3?.CO4)}</td>
                <td>{formatValue(results.coAttainment?.assignment3?.CO5)}</td>
                <td>{formatValue(results.coAttainment?.assignment3?.CO6)}</td>
              </tr>
              <tr className="highlight">
                <td>AVG-Assignment Attainment</td>
                <td>{formatValue(results.coAttainment?.assignmentAvg?.CO1)}</td>
                <td>{formatValue(results.coAttainment?.assignmentAvg?.CO2)}</td>
                <td>{formatValue(results.coAttainment?.assignmentAvg?.CO3)}</td>
                <td>{formatValue(results.coAttainment?.assignmentAvg?.CO4)}</td>
                <td>{formatValue(results.coAttainment?.assignmentAvg?.CO5)}</td>
                <td>{formatValue(results.coAttainment?.assignmentAvg?.CO6)}</td>
              </tr>
              <tr className="highlight">
                <td>IS CO-LEVEL ATTAINED? Internal</td>
                <td className={results.targetAttained?.CO1 ? "yes" : "no"}>
                  {results.targetAttained?.CO1 ? "YES" : "NO"}
                </td>
                <td className={results.targetAttained?.CO2 ? "yes" : "no"}>
                  {results.targetAttained?.CO2 ? "YES" : "NO"}
                </td>
                <td className={results.targetAttained?.CO3 ? "yes" : "no"}>
                  {results.targetAttained?.CO3 ? "YES" : "NO"}
                </td>
                <td className={results.targetAttained?.CO4 ? "yes" : "no"}>
                  {results.targetAttained?.CO4 ? "YES" : "NO"}
                </td>
                <td className={results.targetAttained?.CO5 ? "yes" : "no"}>
                  {results.targetAttained?.CO5 ? "YES" : "NO"}
                </td>
                <td className={results.targetAttained?.CO6 ? "yes" : "no"}>
                  {results.targetAttained?.CO6 ? "YES" : "NO"}
                </td>
              </tr>
            </tbody>
          </table>

          {/* SEE Course Outcome Analysis */}
          <h3>SEE Course Outcome Analysis</h3>
          <table className="results-table">
            <thead>
              <tr>
                <th>Result of SEE</th>
                <th>CO1</th>
                <th>CO2</th>
                <th>CO3</th>
                <th>CO4</th>
                <th>CO5</th>
                <th>CO6</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Level of Attainment</td>
                <td>{formatValue(results.coAttainment?.see?.CO1)}</td>
                <td>{formatValue(results.coAttainment?.see?.CO2)}</td>
                <td>{formatValue(results.coAttainment?.see?.CO3)}</td>
                <td>{formatValue(results.coAttainment?.see?.CO4)}</td>
                <td>{formatValue(results.coAttainment?.see?.CO5)}</td>
                <td>{formatValue(results.coAttainment?.see?.CO6)}</td>
              </tr>
            </tbody>
          </table>

          {/* Final Course Outcome Analysis */}
          <h3>Final Course Outcome Analysis</h3>
          <table className="results-table">
            <thead>
              <tr>
                <th></th>
                <th>CO1</th>
                <th>CO2</th>
                <th>CO3</th>
                <th>CO4</th>
                <th>CO5</th>
                <th>CO6</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>DIRECT ATTAINMENT = x * External Attainment + y * Internal Attainment</td>
                <td>x = {results.parameters?.x}</td>
                <td>y = {results.parameters?.y}</td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
              </tr>
              <tr>
                <td>Internal Attainment Level</td>
                <td>{formatValue(results.coAttainment?.cia?.CO1)}</td>
                <td>{formatValue(results.coAttainment?.cia?.CO2)}</td>
                <td>{formatValue(results.coAttainment?.cia?.CO3)}</td>
                <td>{formatValue(results.coAttainment?.cia?.CO4)}</td>
                <td>{formatValue(results.coAttainment?.cia?.CO5)}</td>
                <td>{formatValue(results.coAttainment?.cia?.CO6)}</td>
              </tr>
              <tr>
                <td>External Attainment Level</td>
                <td>{formatValue(results.coAttainment?.see?.CO1)}</td>
                <td>{formatValue(results.coAttainment?.see?.CO2)}</td>
                <td>{formatValue(results.coAttainment?.see?.CO3)}</td>
                <td>{formatValue(results.coAttainment?.see?.CO4)}</td>
                <td>{formatValue(results.coAttainment?.see?.CO5)}</td>
                <td>{formatValue(results.coAttainment?.see?.CO6)}</td>
              </tr>
              <tr>
                <td>Direct Attainment Level</td>
                <td>{formatValue(results.coAttainment?.direct?.CO1)}</td>
                <td>{formatValue(results.coAttainment?.direct?.CO2)}</td>
                <td>{formatValue(results.coAttainment?.direct?.CO3)}</td>
                <td>{formatValue(results.coAttainment?.direct?.CO4)}</td>
                <td>{formatValue(results.coAttainment?.direct?.CO5)}</td>
                <td>{formatValue(results.coAttainment?.direct?.CO6)}</td>
              </tr>
              <tr>
                <td>Indirect Attainment Level</td>
                <td>{formatValue(results.coAttainment?.indirect?.CO1)}</td>
                <td>{formatValue(results.coAttainment?.indirect?.CO2)}</td>
                <td>{formatValue(results.coAttainment?.indirect?.CO3)}</td>
                <td>{formatValue(results.coAttainment?.indirect?.CO4)}</td>
                <td>{formatValue(results.coAttainment?.indirect?.CO5)}</td>
                <td>{formatValue(results.coAttainment?.indirect?.CO6)}</td>
              </tr>
              <tr>
                <td>u</td>
                <td>{results.parameters?.u}</td>
                <td>{results.parameters?.u}</td>
                <td>{results.parameters?.u}</td>
                <td>{results.parameters?.u}</td>
                <td>{results.parameters?.u}</td>
                <td>{results.parameters?.u}</td>
              </tr>
              <tr>
                <td>v</td>
                <td>{results.parameters?.v}</td>
                <td>{results.parameters?.v}</td>
                <td>{results.parameters?.v}</td>
                <td>{results.parameters?.v}</td>
                <td>{results.parameters?.v}</td>
                <td>{results.parameters?.v}</td>
              </tr>
              <tr className="highlight">
                <td>FINAL CO Attainment = u * Direct Attainment + v * Indirect Attainment</td>
                <td>{formatValue(results.coAttainment?.overall?.CO1)}</td>
                <td>{formatValue(results.coAttainment?.overall?.CO2)}</td>
                <td>{formatValue(results.coAttainment?.overall?.CO3)}</td>
                <td>{formatValue(results.coAttainment?.overall?.CO4)}</td>
                <td>{formatValue(results.coAttainment?.overall?.CO5)}</td>
                <td>{formatValue(results.coAttainment?.overall?.CO6)}</td>
              </tr>
              <tr className="highlight">
                <td>IS CO-Target Attained?</td>
                <td className={results.targetAttained?.CO1 ? "yes" : "no"}>
                  {results.targetAttained?.CO1 ? "YES" : "NO"}
                </td>
                <td className={results.targetAttained?.CO2 ? "yes" : "no"}>
                  {results.targetAttained?.CO2 ? "YES" : "NO"}
                </td>
                <td className={results.targetAttained?.CO3 ? "yes" : "no"}>
                  {results.targetAttained?.CO3 ? "YES" : "NO"}
                </td>
                <td className={results.targetAttained?.CO4 ? "yes" : "no"}>
                  {results.targetAttained?.CO4 ? "YES" : "NO"}
                </td>
                <td className={results.targetAttained?.CO5 ? "yes" : "no"}>
                  {results.targetAttained?.CO5 ? "YES" : "NO"}
                </td>
                <td className={results.targetAttained?.CO6 ? "yes" : "no"}>
                  {results.targetAttained?.CO6 ? "YES" : "NO"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SemesterResultsUpload;