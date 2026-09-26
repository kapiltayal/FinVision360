import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

type SliderProps = React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & {
  thumbLabels?: string[];
  thumbClassNames?: string[];
  onThumbPointerDown?: (index: number) => void;
  onThumbKeyDown?: (index: number) => void;
  trackFill?: {
    startPercent: number;
    endPercent: number;
    className?: string;
  };
};

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(({ className, thumbLabels, thumbClassNames, onThumbPointerDown, onThumbKeyDown, trackFill, ...props }, ref) => {
  const values = props.value ?? props.defaultValue;
  const thumbCount = Array.isArray(values) ? Math.max(values.length, 1) : 1;
  const min = props.min ?? 0;
  const max = props.max ?? 100;
  const step = props.step ?? 1;
  const tickIntervals =
    Number.isFinite(min) && Number.isFinite(max) && Number.isFinite(step) && max > min && step > 0
      ? Math.min(10, Math.floor((max - min) / step + 1e-9))
      : 0;

  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn(
        "relative flex w-full touch-none select-none items-center",
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary">
        {trackFill && (
          <span
            aria-hidden="true"
            className={cn("pointer-events-none absolute h-full bg-primary", trackFill.className)}
            style={{
              left: `${trackFill.startPercent}%`,
              width: `${trackFill.endPercent - trackFill.startPercent}%`,
            }}
          />
        )}
        <SliderPrimitive.Range className={cn("absolute h-full bg-primary", trackFill && "hidden")} />
      </SliderPrimitive.Track>
      {tickIntervals > 0 &&
        Array.from({ length: tickIntervals + 1 }, (_, index) => (
          <span
            key={`tick-${index}`}
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 z-0 h-1.5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-background/80"
            style={{ left: `${(index / tickIntervals) * 100}%` }}
          />
        ))}
      {Array.from({ length: thumbCount }, (_, index) => (
        <SliderPrimitive.Thumb
          key={index}
          aria-label={thumbLabels?.[index]}
          onPointerDown={() => onThumbPointerDown?.(index)}
          onKeyDown={() => onThumbKeyDown?.(index)}
          className={cn(
            "z-10 block h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
            thumbClassNames?.[index],
          )}
        />
      ))}
    </SliderPrimitive.Root>
  );
})
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
