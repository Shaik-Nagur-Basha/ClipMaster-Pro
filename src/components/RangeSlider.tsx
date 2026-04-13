import React from "react";

type Props = {
  min: number;
  max: number;
  valueMin: number;
  valueMax: number;
  onChange: (min: number, max: number) => void;
};

const RangeSlider: React.FC<Props> = ({
  min,
  max,
  valueMin,
  valueMax,
  onChange,
}) => {
  const getPercent = (val: number) =>
    ((val - min) / (max - min)) * 100;

  return (
    <div className="w-full px-2 py-3">

      {/* Labels */}
      <div className="flex justify-between text-[10px] text-gray-500 mb-1">
        <span>{valueMin.toLocaleString()}</span>
        <span>{valueMax.toLocaleString()}</span>
      </div>

      <div className="relative w-full">

        {/* Outer Bar */}
        <div className="absolute h-1.5 w-full rounded-full z-10" />

        {/* Inner Bar */}
        <div
          className="absolute h-1.5 bg-brand-500 rounded-full z-20"
          style={{
            left: `${getPercent(valueMin)}%`,
            width: `${getPercent(valueMax) - getPercent(valueMin)}%`,
          }}
        />

        {/* Min Thumb */}
        <input
          type="range"
          min={min}
          max={max}
          value={valueMin}
          onChange={(e) => {
            const val = Math.min(Number(e.target.value), valueMax);
            onChange(val, valueMax);
          }}
          className="absolute rounded-full w-full h-1.5 top-0 z-30 appearance-none bg-transparent pointer-events-none
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:pointer-events-auto
          [&::-webkit-slider-thumb]:w-3.5
          [&::-webkit-slider-thumb]:h-3.5
          [&::-webkit-slider-thumb]:z-50
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-white
          [&::-webkit-slider-thumb]:border
          [&::-webkit-slider-thumb]:border-gray-400
          [&::-webkit-slider-thumb]:cursor-pointer"
        />

        {/* Max Thumb */}
        <input
          type="range"
          min={min}
          max={max}
          value={valueMax}
          onChange={(e) => {
            const val = Math.max(Number(e.target.value), valueMin);
            onChange(valueMin, val);
          }}
          className="absolute rounded-full w-full h-1.5 top-0 z-30 appearance-none bg-transparent pointer-events-none
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:pointer-events-auto
          [&::-webkit-slider-thumb]:w-3.5
          [&::-webkit-slider-thumb]:h-3.5
          [&::-webkit-slider-thumb]:z-50
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-white
          [&::-webkit-slider-thumb]:border
          [&::-webkit-slider-thumb]:border-gray-400
          [&::-webkit-slider-thumb]:cursor-pointer"
        />

      </div>

      {/* Min / Max labels */}
      <div className="flex justify-between text-[10px] text-gray-500 mt-4">
        <span>Min: {min.toLocaleString()}</span>
        <span>Max: {max.toLocaleString()}</span>
      </div>
    </div>
  );
};

export default RangeSlider;