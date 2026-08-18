import { useState, useCallback } from 'react';
import { AppState } from '../types';

export function useHistory(initialState: AppState) {
  const [history, setHistory] = useState<AppState[]>([initialState]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  const setState = useCallback(
    (action: AppState | ((prev: AppState) => AppState)) => {
      setHistory((prevHistory) => {
        const nextState = typeof action === 'function' ? action(prevHistory[currentIndex]) : action;
        const newHistory = prevHistory.slice(0, currentIndex + 1);
        newHistory.push(nextState);
        setCurrentIndex(newHistory.length - 1);
        return newHistory;
      });
    },
    [currentIndex]
  );

  const undo = useCallback(() => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const redo = useCallback(() => {
    setHistory((prevHistory) => {
      setCurrentIndex((prev) => Math.min(prevHistory.length - 1, prev + 1));
      return prevHistory;
    });
  }, []);

  return {
    state: history[currentIndex],
    setState,
    undo,
    redo,
    canUndo: currentIndex > 0,
    canRedo: currentIndex < history.length - 1,
  };
}
