import React, { useState } from 'react';
import './App.css'; // Import the custom CSS file

function App() {
  // Quiz state
  const [selectedClass, setSelectedClass] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState(''); // This will now come from Gemini
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState('');
  const [score, setScore] = useState(0);
  const [questionCount, setQuestionCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false); // Used for both question generation and answer validation
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');

  // LLM-powered features state
  const [showExplanationModal, setShowExplanationModal] = useState(false);
  const [explanationText, setExplanationText] = useState('');
  const [isGeneratingExplanation, setIsGeneratingExplanation] = useState(false);
  const [hintText, setHintText] = useState('');
  const [isGeneratingHint, setIsGeneratingHint] = useState(false);

  // Function to generate a random math question based on class using Gemini API
  const generateQuestion = async (className) => {
    setIsLoading(true); // Start loading for question generation
    setFeedback(''); // Clear previous feedback
    setHintText(''); // Clear previous hint
    setExplanationText(''); // Clear previous explanation
    setShowExplanationModal(false); // Close explanation modal if open

    try {
      let prompt = `Generate a random math question suitable for a "${className}" student. Also, provide the correct answer.
        Return a JSON object with the following structure:
        {
          "question": "string",
          "correctAnswer": "string"
        }
        Ensure the question is clear and the answer is precise. For questions involving pi, use 3.14. For square roots, use sqrt(). For fractions, use a/b format. For algebraic expressions, simplify them.`;

      // Enhance prompt for specific classes to encourage variety
      if (className === 'Class 6-8') {
        prompt = `Generate a random math question suitable for a "Class 6-8" student. Include topics like linear equations, percentages, fractions, area, perimeter, or volume of basic shapes. Also, provide the correct answer.
          Return a JSON object with the following structure:
          {
            "question": "string",
            "correctAnswer": "string"
          }
          Ensure the question is clear and the answer is precise. For questions involving pi, use 3.14. For square roots, use sqrt(). For fractions, use a/b format. For algebraic expressions, simplify them.`;
      } else if (className === 'Class 9-10') {
        prompt = `Generate a random math question suitable for a "Class 9-10" student. Include topics like quadratic equations, Pythagorean theorem, basic trigonometry (sin, cos, tan), algebraic expansion/factorization, or more complex geometry problems. Also, provide the correct answer.
          Return a JSON object with the following structure:
          {
            "question": "string",
            "correctAnswer": "string"
          }
          Ensure the question is clear and the answer is precise. For questions involving pi, use 3.14. For square roots, use sqrt(). For fractions, use a/b format. For algebraic expressions, simplify them.`;
      }


      let chatHistory = [];
      chatHistory.push({ role: "user", parts: [{ text: prompt }] });

      const payload = {
        contents: chatHistory,
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              "question": { "type": "STRING" },
              "correctAnswer": { "type": "STRING" }
            },
            required: ["question", "correctAnswer"]
          }
        }
      };

      // === IMPORTANT: Replace "AIzaSyAEzuMBYVI7oRDlEKhyxrKXKChewkYYPsI" with your actual Gemini API key ===
      const apiKey = "AIzaSyAEzuMBYVI7oRDlEKhyxrKXKChewkYYPsI"; // Get your key from https://aistudio.google.com/app/apikey
      // =================================================================================
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API error: ${response.status} ${response.statusText} - ${errorData.error.message}`);
      }

      const result = await response.json();

      if (result.candidates && result.candidates.length > 0 &&
          result.candidates[0].content && result.candidates[0].content.parts &&
          result.candidates[0].content.parts.length > 0) {
        const jsonResponse = result.candidates[0].content.parts[0].text;
        const parsedResponse = JSON.parse(jsonResponse);

        setCurrentQuestion(parsedResponse.question);
        setCorrectAnswer(parsedResponse.correctAnswer);
        setUserAnswer(''); // Clear user's previous answer
      } else {
        throw new Error("Invalid response structure from LLM for question generation.");
      }
    } catch (error) {
      console.error("Error generating question with LLM:", error);
      setModalMessage(`Could not generate question: ${error.message}. Please check your API key and network connection.`);
      setShowModal(true);
      setCurrentQuestion('Failed to load question. Please try again or select another class.');
      setCorrectAnswer('');
      setUserAnswer('');
    } finally {
      setIsLoading(false); // End loading
    }
  };

  // Handle class selection
  const handleClassSelect = async (className) => {
    setSelectedClass(className);
    await generateQuestion(className); // Await question generation
  };

  // Submit user's answer for validation
  const handleSubmitAnswer = async () => {
    if (!userAnswer.trim()) {
      setModalMessage("Please enter an answer before submitting.");
      setShowModal(true);
      return;
    }

    setIsLoading(true); // Start loading for validation
    setFeedback('');
    setHintText(''); // Clear hint after submission

    try {
      const prompt = `
        Question: "${currentQuestion}"
        User's Answer: "${userAnswer}"
        Correct Answer: "${correctAnswer}"

        Compare the User's Answer with the Correct Answer.
        Consider numerical equivalence, common mathematical representations (e.g., fractions vs decimals), and units (if applicable).
        If the user's answer is mathematically equivalent or very close to the correct answer, consider it correct.
        Provide a concise feedback message.

        Return a JSON object with the following structure:
        {
          "isCorrect": boolean,
          "correctAnswer": string,
          "feedback": string
        }
      `;

      let chatHistory = [];
      chatHistory.push({ role: "user", parts: [{ text: prompt }] });

      const payload = {
        contents: chatHistory,
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              "isCorrect": { "type": "BOOLEAN" },
              "correctAnswer": { "type": "STRING" },
              "feedback": { "type": "STRING" }
            },
            required: ["isCorrect", "correctAnswer", "feedback"]
          }
        }
      };

      // === IMPORTANT: Replace "AIzaSyAEzuMBYVI7oRDlEKhyxrKXKChewkYYPsI" with your actual Gemini API key ===
      const apiKey = "AIzaSyAEzuMBYVI7oRDlEKhyxrKXKChewkYYPsI"; // Get your key from https://aistudio.google.com/app/apikey
      // =================================================================================
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API error: ${response.status} ${response.statusText} - ${errorData.error.message}`);
      }

      const result = await response.json();

      if (result.candidates && result.candidates.length > 0 &&
          result.candidates[0].content && result.candidates[0].content.parts &&
          result.candidates[0].content.parts.length > 0) {
        const jsonResponse = result.candidates[0].content.parts[0].text;
        const parsedResponse = JSON.parse(jsonResponse);

        setFeedback(parsedResponse.feedback);

        let newScore = score;
        if (parsedResponse.isCorrect) {
          newScore += 1;
          setScore(newScore);
        }
        setQuestionCount(prev => prev + 1);

      } else {
        throw new Error("Invalid response structure from LLM.");
      }
    } catch (error) {
      console.error("Error validating answer with LLM:", error);
      setFeedback(`Error validating answer: ${error.message}.`);
      setModalMessage(`There was an issue validating your answer. Please try again. Details: ${error.message}`);
      setShowModal(true);
    } finally {
      setIsLoading(false); // End loading
    }
  };

  // Function to get a hint from Gemini
  const handleGetHint = async () => {
    setIsGeneratingHint(true);
    setHintText(''); // Clear previous hint

    try {
      const prompt = `Provide a subtle hint for the following math question: "${currentQuestion}". Do not give away the answer directly. Keep it concise.`;

      let chatHistory = [];
      chatHistory.push({ role: "user", parts: [{ text: prompt }] });

      const payload = {
        contents: chatHistory,
      };

      // === IMPORTANT: Replace "AIzaSyAEzuMBYVI7oRDlEKhyxrKXKChewkYYPsI" with your actual Gemini API key ===
      const apiKey = "AIzaSyAEzuMBYVI7oRDlEKhyxrKXKChewkYYPsI"; // Get your key from https://aistudio.google.com/app/apikey
      // =================================================================================
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API error: ${response.status} ${response.statusText} - ${errorData.error.message}`);
      }

      const result = await response.json();

      if (result.candidates && result.candidates.length > 0 &&
          result.candidates[0].content && result.candidates[0].content.parts &&
          result.candidates[0].content.parts.length > 0) {
        setHintText(result.candidates[0].content.parts[0].text);
      } else {
        throw new Error("Invalid response structure from LLM for hint.");
      }
    } catch (error) {
      console.error("Error generating hint with LLM:", error);
      setModalMessage(`Could not generate a hint: ${error.message}.`);
      setShowModal(true);
    } finally {
      setIsGeneratingHint(false);
    }
  };

  // Function to get an explanation from Gemini
  const handleExplainAnswer = async () => {
    setIsGeneratingExplanation(true);
    setExplanationText(''); // Clear previous explanation
    setShowExplanationModal(true); // Open modal immediately

    try {
      const prompt = `
        Question: "${currentQuestion}"
        Correct Answer: "${correctAnswer}"
        Provide a simple and concise explanation for how to solve this math problem. Focus on the core concept and the main steps.
      `;

      let chatHistory = [];
      chatHistory.push({ role: "user", parts: [{ text: prompt }] });

      const payload = {
        contents: chatHistory,
      };

      // === IMPORTANT: Replace "AIzaSyAEzuMBYVI7oRDlEKhyxrKXKChewkYYPsI" with your actual Gemini API key ===
      const apiKey = "AIzaSyAEzuMBYVI7oRDlEKhyxrKXKChewkYYPsI"; // Get your key from https://aistudio.google.com/app/apikey
      // =================================================================================
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API error: ${response.status} ${response.statusText} - ${errorData.error.message}`);
      }

      const result = await response.json();

      if (result.candidates && result.candidates.length > 0 &&
          result.candidates[0].content && result.candidates[0].content.parts &&
          result.candidates[0].content.parts.length > 0) {
        setExplanationText(result.candidates[0].content.parts[0].text);
      } else {
        throw new Error("Invalid response structure from LLM for explanation.");
      }
    } catch (error) {
      console.error("Error generating explanation with LLM:", error);
      setExplanationText(`Could not generate explanation: ${error.message}.`);
    } finally {
      setIsGeneratingExplanation(false);
    }
  };


  // Move to the next question
  const handleNextQuestion = async () => {
    await generateQuestion(selectedClass); // Generate new question
  };

  // Reset quiz
  const handleResetQuiz = () => {
    setSelectedClass(null);
    setCurrentQuestion('');
    setCorrectAnswer('');
    setUserAnswer('');
    setFeedback('');
    setScore(0);
    setQuestionCount(0);
    setIsLoading(false);
    setHintText('');
    setExplanationText('');
    setShowExplanationModal(false);
  };

  return (
    <div className="app-container">
      <div className="quiz-card">
        <h1 className="quiz-title">
          Math Quiz Challenge
        </h1>

        <>
          <div className="score-area">
            <p className="score-display">
              Score: {score} / {questionCount}
            </p>
          </div>

          {!selectedClass ? (
            <div className="class-selection">
              <h2 className="class-selection-title">
                Which class's math questions would you like to practice?
              </h2>
              <div className="class-buttons-grid">
                {['Class 1-2', 'Class 3-5', 'Class 6-8', 'Class 9-10'].map((className) => (
                  <button
                    key={className}
                    onClick={() => handleClassSelect(className)}
                    className="class-button"
                  >
                    {className}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <h2 className="current-class-title">
                Class: {selectedClass}
              </h2>
              <div className="question-box">
                {isLoading ? (
                  <div className="question-loading">
                    <svg className="spinner" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="spinner-path-bg"></circle>
                      <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="spinner-path"></path>
                    </svg>
                    <span className="question-loading-text">Generating question...</span>
                  </div>
                ) : (
                  <p className="question-text">
                    Question: {currentQuestion}
                  </p>
                )}
                <input
                  type="text"
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  placeholder="Type your answer here..."
                  className="answer-input"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !isLoading) {
                      handleSubmitAnswer();
                    }
                  }}
                  disabled={isLoading || isGeneratingHint || isGeneratingExplanation || !currentQuestion}
                />
              </div>

              {hintText && (
                <div className="hint-box">
                  <p className="hint-text">Hint: {hintText}</p>
                </div>
              )}

              <div className="action-buttons-group">
                <button
                  onClick={handleSubmitAnswer}
                  disabled={isLoading || isGeneratingHint || isGeneratingExplanation || !currentQuestion}
                  className={`submit-button ${isLoading ? 'button-disabled' : ''}`}
                >
                  {isLoading ? (
                    <span className="button-loading">
                      <svg className="spinner" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="spinner-path-bg"></circle>
                        <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="spinner-path"></path>
                      </svg>
                      Validating...
                    </span>
                  ) : (
                    'Submit Answer'
                  )}
                </button>
                <button
                  onClick={handleGetHint}
                  disabled={isLoading || isGeneratingHint || isGeneratingExplanation || !currentQuestion}
                  className={`hint-button ${isGeneratingHint ? 'button-disabled' : ''}`}
                >
                  {isGeneratingHint ? (
                     <span className="button-loading">
                     <svg className="spinner" viewBox="0 0 24 24">
                       <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="spinner-path-bg"></circle>
                       <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="spinner-path"></path>
                     </svg>
                     Getting Hint...
                   </span>
                  ) : (
                    'Get Hint ✨'
                  )}
                </button>
              </div>

              {feedback && (
                <div className={`feedback-box ${feedback.includes('Correct') ? 'feedback-correct' : 'feedback-incorrect'}`}>
                  <p className="feedback-text">{feedback}</p>
                  {feedback.includes('Incorrect') && (
                    <p className="correct-answer-text">The correct answer was: <span className="correct-answer-value">{correctAnswer}</span></p>
                  )}
                  <button
                    onClick={handleExplainAnswer}
                    disabled={isGeneratingExplanation || !currentQuestion}
                    className={`explain-button ${isGeneratingExplanation ? 'button-disabled' : ''}`}
                  >
                    {isGeneratingExplanation ? (
                      <span className="button-loading">
                      <svg className="spinner" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="spinner-path-bg"></circle>
                        <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="spinner-path"></path>
                      </svg>
                      Getting Explanation...
                    </span>
                    ) : (
                      'Explain Answer ✨'
                    )}
                  </button>
                </div>
              )}

              <div className="bottom-buttons-group">
                <button
                  onClick={handleNextQuestion}
                  disabled={isLoading || isGeneratingHint || isGeneratingExplanation}
                  className={`next-button ${isLoading ? 'button-disabled' : ''}`}
                >
                  Next Question
                </button>
                <button
                  onClick={handleResetQuiz}
                  className="reset-button"
                >
                  Reset Quiz
                </button>
              </div>
            </div>
          )}
        </>

        {/* Custom Modal for general alerts */}
        {showModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h3 className="modal-title">Notification</h3>
              <p className="modal-message">{modalMessage}</p>
              <button
                onClick={() => setShowModal(false)}
                className="modal-button"
              >
                OK
              </button>
            </div>
          </div>
        )}

        {/* Custom Modal for Explanation */}
        {showExplanationModal && (
          <div className="modal-overlay">
            <div className="modal-content explanation-modal-content">
              <h3 className="modal-title">Explanation</h3>
              {isGeneratingExplanation ? (
                <div className="explanation-loading">
                  <svg className="spinner" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="spinner-path-bg"></circle>
                    <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="spinner-path"></path>
                  </svg>
                  <span className="explanation-loading-text">Generating explanation...</span>
                </div>
              ) : (
                <div className="explanation-text-area">
                  {explanationText.split('\n').map((line, index) => (
                    <p key={index} className="explanation-line">{line}</p>
                  ))}
                </div>
              )}
              <div className="modal-button-group">
                <button
                  onClick={() => setShowExplanationModal(false)}
                  className="modal-button"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
