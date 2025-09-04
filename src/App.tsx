import React from "react";
import SquarePackingGame from "./SquarePackingGame";

export default function App() {
  return (
    <div className="min-h-screen flex items-stretch justify-center">
      <div className="max-w-6xl w-full">
        <SquarePackingGame />
      </div>
    </div>
  );
}