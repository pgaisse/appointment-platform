
import { FaThumbsUp } from "react-icons/fa";
import {
  MdCheckCircle,
  MdArrowUpward,
  MdInfo,
  MdWarning,
  MdStars,
} from "react-icons/md";

type MatchLevel = "Perfect Match" | "High Match" | "Medium Match" | "Low Match";

interface MatchIconResult {
  icon: React.ElementType;
  color: string;
}

export const getMatchLevelIcon = (matchLevel: MatchLevel): MatchIconResult => {
  const config: Record<MatchLevel, MatchIconResult> = {
    "Perfect Match": {
      icon: MdStars,
      color: "green.400",
    },
    "High Match": {
      icon: FaThumbsUp,
      color: "blue.400",
    },
    "Medium Match": {
      icon: MdInfo,
      color: "yellow.400",
    },
    "Low Match": {
      icon: MdWarning,
      color: "orange.400",
    },
  };

  return config[matchLevel];
};
