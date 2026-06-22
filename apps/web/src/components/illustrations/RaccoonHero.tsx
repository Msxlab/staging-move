import { RaccoonMark } from "./RaccoonMark";

type RaccoonHeroProps = {
  size?: number;
  className?: string;
};

export function RaccoonHero({ size = 168, className }: RaccoonHeroProps) {
  return <RaccoonMark size={size} height={Math.round(size * (150 / 168))} mood="approved" className={className} />;
}

export default RaccoonHero;
