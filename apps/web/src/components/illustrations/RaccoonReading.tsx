import { RaccoonMark } from "./RaccoonMark";

type RaccoonReadingProps = {
  size?: number;
  className?: string;
};

export function RaccoonReading({ size = 168, className }: RaccoonReadingProps) {
  return <RaccoonMark size={size} height={Math.round(size * (120 / 168))} mood="thinking" className={className} />;
}

export default RaccoonReading;
