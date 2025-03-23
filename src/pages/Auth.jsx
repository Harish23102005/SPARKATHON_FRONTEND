// src/pages/Auth.jsx
import React, { useState } from "react";
import LoginSignup from "./LoginSignup";
import "./LoginSignup.css";

const Auth = () => {
  const [isSignup, setIsSignup] = useState(true);

  // Create an array of spans for the background grid
  const spans = Array.from({ length: 480 }).map((_, index) => (
    <span key={index}></span>
  ));

  return (
    <>
      <section>
        {spans}
      </section>
      <div className="container d-flex justify-content-center align-items-center vh-100">
        <div className="card p-4 shadow" style={{ maxWidth: "400px", width: "100%" }}>
          <LoginSignup isSignup={isSignup} setIsSignup={setIsSignup} />
        </div>
      </div>
    </>
  );
};

export default Auth;