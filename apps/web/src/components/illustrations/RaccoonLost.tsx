import { RaccoonMark } from "./RaccoonMark";

type RaccoonLostProps = {
  size?: number;
  className?: string;
};

export function RaccoonLost({ size = 140, className }: RaccoonLostProps) {
  return <RaccoonMark size={size} height={Math.round(size * (134 / 124))} mood="alert" className={className} />;
}

export default RaccoonLost;
