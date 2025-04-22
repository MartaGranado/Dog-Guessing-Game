import React, { useState, useEffect, useCallback } from 'react';
import './App.css';

function App() {
  // const MAX_ATTEMPTS = 3; // No longer needed for game over
  const HINT_THRESHOLD = 3; // Number of wrong attempts before hint is available
  const API_URL_RANDOM = 'https://dog.ceo/api/breeds/image/random';
  const API_URL_LIST_ALL = 'https://dog.ceo/api/breeds/list/all';

  // Game State
  const [imageUrl, setImageUrl] = useState('');
  const [breedName, setBreedName] = useState(''); // The correct answer (lowercase)
  const [userGuess, setUserGuess] = useState('');
  // const [attempts, setAttempts] = useState(0); // Total attempts - less critical now, but can keep for info
  const [wrongAttempts, setWrongAttempts] = useState(0); // Track only incorrect guesses for hint
  const [gameState, setGameState] = useState('loading'); // loading, playing, won, gaveUp, error
  const [showHint, setShowHint] = useState(false);
  const [hintAvailable, setHintAvailable] = useState(false);
  const [error, setError] = useState(null);
  const [feedbackMessage, setFeedbackMessage] = useState(''); // Optional: feedback on wrong guess

  // Autocomplete State
  const [allBreeds, setAllBreeds] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [isFetchingBreeds, setIsFetchingBreeds] = useState(true);
  const [guessedBreeds, setGuessedBreeds] = useState([]);


  // --- Helper Functions (keep getBreedFromUrl and processBreedList as before) ---
    const getBreedFromUrl = (url) => {
        if (!url) return '';
        const parts = url.split('/');
        if (parts.length >= 2) {
            const breedPart = parts[parts.length - 2];
            return breedPart.replace('-', ' ');
        }
        return '';
    };

    const processBreedList = (data) => {
        const breeds = [];
        for (const breed in data) {
        if (data[breed].length === 0) {
            breeds.push(breed);
        } else {
            data[breed].forEach(subBreed => {
            breeds.push(`${breed} ${subBreed}`);
            });
        }
        }
        return breeds.sort();
    };

  // --- Data Fetching (fetch All Breeds useEffect remains the same) ---
   useEffect(() => {
    const fetchAllBreeds = async () => {
      setIsFetchingBreeds(true);
      setError(null);
      try {
        const response = await fetch(API_URL_LIST_ALL);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        if (data.status === 'success' && data.message) {
          const processedBreeds = processBreedList(data.message);
          setAllBreeds(processedBreeds);
        } else throw new Error('Failed to fetch breed list from API.');
      } catch (e) {
        console.error("Error fetching breed list:", e);
        setError(`Failed to load breed suggestions: ${e.message}`);
      } finally {
        setIsFetchingBreeds(false);
      }
    };
    fetchAllBreeds();
  }, []);

  // Fetch new dog image and reset game state
  const fetchNewGame = useCallback(async () => {
    setGameState('loading');
    setImageUrl('');
    setBreedName('');
    setUserGuess('');
    // setAttempts(0);
    setWrongAttempts(0); // Reset wrong attempts counter
    setShowHint(false);
    setHintAvailable(false);
    setSuggestions([]);
    setError(null);
    setFeedbackMessage(''); // Clear feedback
    setGuessedBreeds([]); // Reset guessed breeds
    setAllBreeds(allBreeds); 


    // Wait briefly if breeds are still fetching (optional, avoids race condition)
    if (isFetchingBreeds) {
       console.log("Waiting for breed list before fetching image...");
       // Basic wait, replace with better logic if needed
       // await new Promise(resolve => setTimeout(resolve, 500));
    }

    try {
      const response = await fetch(API_URL_RANDOM);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (data.status === 'success' && data.message) {
        setImageUrl(data.message);
        const extractedBreed = getBreedFromUrl(data.message);
        if (extractedBreed) {
           setBreedName(extractedBreed.toLowerCase());
           setGameState('playing');
        } else throw new Error("Could not parse breed name from URL.");
      } else throw new Error('Failed to fetch dog image from API.');
    } catch (e) {
      console.error("Error fetching dog:", e);
      setError(e.message || 'An unknown error occurred while fetching the image.');
      setGameState('error');
    }
  }, [isFetchingBreeds]); // Depend on isFetchingBreeds to potentially re-run if needed

  // Fetch dog for the first time after breed list might be ready
  useEffect(() => {
    if (!isFetchingBreeds) {
        fetchNewGame();
    }
  }, [isFetchingBreeds, fetchNewGame]);


  // --- Event Handlers ---

  // Handle user typing (remains the same)
  const handleInputChange = (e) => {
    const value = e.target.value;
    setUserGuess(value);
    setFeedbackMessage(''); // Clear feedback when typing

    if (value.length > 0 && allBreeds.length > 0) {
      const filteredSuggestions = allBreeds.filter(breed =>
        breed.toLowerCase().startsWith(value.toLowerCase())
      );
      setSuggestions(filteredSuggestions);
    } else {
      setSuggestions([]);
    }
  };

  // Show dropdown even after showing hint
  useEffect(() => {
    // Recalculate suggestions when showHint is activated
    if (showHint && userGuess && allBreeds.length > 0) {
      const filteredSuggestions = allBreeds.filter(breed =>
        breed.toLowerCase().startsWith(userGuess.toLowerCase())
      );
      setSuggestions(filteredSuggestions);
    }
  }, [showHint, userGuess, allBreeds]);
  

  // Handle clicking suggestion (remains the same)
  const handleSuggestionClick = (suggestion) => {
    setUserGuess(suggestion);
    setSuggestions([]);
    setFeedbackMessage(''); // Clear feedback
  };

  // Handle guess submission - UPDATED LOGIC
  const handleGuessSubmit = (e) => {
    e.preventDefault();
    if (gameState !== 'playing') return;
  
    let guessToCheck = userGuess.trim().toLowerCase();
  
    // If the guess has already been made, block submission
    if (guessedBreeds.includes(guessToCheck)) {
      setFeedbackMessage('You already tried that!');
      return;
    }
  
    // Get current suggestions again for validation
    const matchingSuggestions = allBreeds.filter(breed =>
      breed.toLowerCase().startsWith(guessToCheck)
    );
  
    // If no suggestions left for that prefix, block submission
    if (matchingSuggestions.length === 0) {
      setFeedbackMessage('No more breeds match this input.');
      return;
    }
  
    // Auto-select first suggestion if guess doesn't match any exactly
    const exactMatch = matchingSuggestions.find(b => b.toLowerCase() === guessToCheck);
    if (!exactMatch) {
      guessToCheck = matchingSuggestions[0].toLowerCase();
      setUserGuess(matchingSuggestions[0]); // Update visible input
    }
  
    setSuggestions([]);
    setFeedbackMessage('');
    setGuessedBreeds(prev => [...prev, guessToCheck]); // Add to guessed
  
    if (guessToCheck === breedName) {
      setGameState('won');
      setFeedbackMessage(`Correct! It's a "${breedName}"!`);
    } else {
      const currentWrongAttempts = wrongAttempts + 1;
      setWrongAttempts(currentWrongAttempts);
      setFeedbackMessage('Incorrect, try again!');
  
      setAllBreeds(prevBreeds =>
        prevBreeds.filter(breed => breed.toLowerCase() !== guessToCheck)
      );
  
      setUserGuess('');
  
      if (currentWrongAttempts >= HINT_THRESHOLD && !hintAvailable) {
        setHintAvailable(true);
      }
    }
  };
  

  // Handle hint click (remains the same)
  const handleHintClick = () => {
    if (hintAvailable) {
      setShowHint(true);
       setFeedbackMessage(''); // Clear "Incorrect" message when hint is shown

    // Pre-fill the input with the first letter of the breed after hint!
    // if (breedName) {
    //   setUserGuess(breedName.charAt(0));
    // }
    }
  };

  // Handle give up (remains the same)
  const handleGiveUp = () => {
    setGameState('gaveUp');
    setSuggestions([]);
    setFeedbackMessage(`The correct breed was "${breedName}".`); // Set give up message
  };

  // Handle play again (calls fetchNewGame which resets everything)
  const handlePlayAgain = () => {
    fetchNewGame();
  };

  // --- Render Logic ---

  const isInputDisabled = gameState !== 'playing' || gameState === 'loading';

  return (
    <div className="App">
      <h1>🐶Guess the Dog Breed!🐕</h1>

      {gameState === 'loading' && <p>Loading game...</p>}
      {error && !imageUrl && gameState !== 'error' && <p className="error-message">{error}</p>}
      {gameState === 'error' && <p className="error-message">Error: {error} <button onClick={fetchNewGame}>Try Again</button></p>}


      {/* Lives Box */}
      {gameState === 'playing' && !showHint && (
      <div
        className={`lives-box ${wrongAttempts >= HINT_THRESHOLD ? 'pulsating hint-mode' : ''}`}
        onClick={() => {
          if (wrongAttempts >= HINT_THRESHOLD) {
            handleHintClick();
          }
        }}
        title={wrongAttempts >= HINT_THRESHOLD ? "Click to reveal hint!" : "Remaining tries"}
      >
        {wrongAttempts >= HINT_THRESHOLD ? 'Hint!' : Math.max(HINT_THRESHOLD - wrongAttempts, 0)}
      </div>
    )}


      {imageUrl && gameState !== 'loading' && gameState !== 'error' && (
      <div className="game-area">
        
        {/* Show hint text */}
        {gameState === 'playing' && showHint && breedName && (
          <p className="hint-revealed">
            Hint: The breed starts with "{breedName.charAt(0).toUpperCase()}"
          </p>
        )}

        <img src={imageUrl} alt="Dog to guess" className="dog-image" />


          <div className="controls">
            {/* Display feedback message */}
            {feedbackMessage && (
                <p className={`feedback ${gameState === 'won' ? 'success' : gameState === 'gaveUp' ? 'gave-up' : 'error'}`}>
                    {feedbackMessage}
                </p>
            )}

            {gameState === 'playing' && (
              <form onSubmit={handleGuessSubmit} className="guess-form">
                <div className="input-container">
                  <input
                    type="text"
                    value={userGuess}
                    onChange={handleInputChange}
                    placeholder="Enter breed name"
                    disabled={isInputDisabled}
                    aria-label="Enter breed name"
                    autoComplete="off"
                    
                  />
                  {suggestions.length > 0 && (
                    <ul className="suggestions-list">
                      {suggestions.map((suggestion, index) => (
                        <li
                          key={index}
                          onClick={() => handleSuggestionClick(suggestion)}
                          tabIndex={0}
                           onKeyPress={(e) => (e.key === 'Enter' || e.key === ' ') && handleSuggestionClick(suggestion)}
                        >
                          {suggestion}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {/* Updated Button Text */}
                <button type="submit" disabled={isInputDisabled || !userGuess.trim()}>
                  Guess
                </button>
              </form>
            )}

             {/* Control Buttons */}
             {gameState === 'playing' && ( // Show Give Up button always when playing
               <button onClick={handleGiveUp} className="give-up-button">
                 Give Up
               </button>
             )}

            {(gameState === 'won' || gameState === 'gaveUp') && ( // Show Play Again only when won or gave up
              <button onClick={handlePlayAgain} className="play-again-button">
                Play Again?
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;