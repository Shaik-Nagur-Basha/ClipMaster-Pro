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
  const getPercent = (val: number) => ((val - min) / (max - min)) * 100;
  const minPercent = getPercent(valueMin);
  const maxPercent = getPercent(valueMax);
  const isMinThumbAtRight = valueMin > max - (max - min) / 2;

  return (
    <div className="w-full px-2 py-3">
      {/* Labels */}
      <div className="flex justify-between text-[10px] text-gray-500 mb-1">
        <span>{valueMin.toLocaleString()}</span>
        <span>{valueMax.toLocaleString()}</span>
      </div>

      <div className="w-full relative">
        {/* Outer Bar */}
        <div className="border-[1px] border-gray-500/50 h-5 w-full rounded-full relative">
          {/* Inner Bar */}
          <div
            className="absolute border-0 h-[75%] bg-brand-500/45 rounded-full top-0.5"
            style={{
              left: `calc(${minPercent}% + 2px)`,
              width: `calc(${maxPercent - minPercent}% - 5px)`,
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
            className="absolute w-[calc(100%-4px)] border-0 h-full pl-1 pb-[0.5px] appearance-none bg-transparent pointer-events-none rounded-full
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:pointer-events-auto
              [&::-webkit-slider-thumb]:w-2.5
              [&::-webkit-slider-thumb]:h-2.5
              [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:bg-white/85
              [&::-webkit-slider-thumb]:border-0
              [&::-webkit-slider-thumb]:border-gray-400
              [&::-webkit-slider-thumb]:cursor-pointer
              [&::-moz-range-thumb]:w-2.5
              [&::-moz-range-thumb]:h-2.5
              [&::-moz-range-thumb]:rounded-full
              [&::-moz-range-thumb]:bg-white/85
              [&::-moz-range-thumb]:border-0
              [&::-moz-range-thumb]:cursor-pointer"
            style={{
              zIndex: isMinThumbAtRight ? 5 : 3,
              top: 0,
              right: "4px",
            }}
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
            className="absolute w-[calc(100%-4px)] border-0 h-full pr-1.5 pb-[0.5px] appearance-none bg-transparent pointer-events-none rounded-full
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:pointer-events-auto
              [&::-webkit-slider-thumb]:w-2.5
              [&::-webkit-slider-thumb]:h-2.5
              [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:bg-white/85
              [&::-webkit-slider-thumb]:border-0
              [&::-webkit-slider-thumb]:border-gray-400
              [&::-webkit-slider-thumb]:cursor-pointer
              [&::-moz-range-thumb]:w-2.5
              [&::-moz-range-thumb]:h-2.5
              [&::-moz-range-thumb]:rounded-full
              [&::-moz-range-thumb]:bg-white/85
              [&::-moz-range-thumb]:border-0
              [&::-moz-range-thumb]:cursor-pointer"
            style={{
              zIndex: isMinThumbAtRight ? 3 : 5,
              top: 0,
              left: "4px",
            }}
          />
        </div>
      </div>

      {/* Min / Max labels */}
      <div className="flex justify-between text-[10px] text-gray-500 mt-0.5">
        <span>Min: {min.toLocaleString()}</span>
        <span>Max: {max.toLocaleString()}</span>
      </div>
    </div>
  );
};

export default RangeSlider;