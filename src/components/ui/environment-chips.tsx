"use client";

import { Chip } from "@mui/material";
import { Environment } from "@/types";

interface EnvironmentChipsProps {
  environment: Environment;
  size?: "small" | "medium";
  variant?: "filled" | "outlined";
  clickable?: boolean;
  onClick?: () => void;
}

interface MultiEnvironmentChipsProps {
  environments: Environment[];
  size?: "small" | "medium";
  variant?: "filled" | "outlined";
  onEnvironmentClick?: (environment: Environment) => void;
}

export function getEnvironmentColor(environment: Environment) {
  switch (environment) {
    case "development":
      return "info" as const;
    case "staging":
      return "warning" as const;
    case "production":
      return "success" as const;
    default:
      return "default" as const;
  }
}

export function getEnvironmentLabel(environment: Environment): string {
  return environment.charAt(0).toUpperCase() + environment.slice(1);
}

export function EnvironmentChip({
  environment,
  size = "small",
  variant = "filled",
  clickable = false,
  onClick,
}: EnvironmentChipsProps) {
  return (
    <Chip
      label={getEnvironmentLabel(environment)}
      color={getEnvironmentColor(environment)}
      size={size}
      variant={variant}
      clickable={clickable}
      onClick={onClick}
    />
  );
}

export function EnvironmentChips({
  environments,
  size = "small",
  variant = "filled",
  onEnvironmentClick,
}: MultiEnvironmentChipsProps) {
  return (
    <>
      {environments.map((env) => (
        <EnvironmentChip
          key={env}
          environment={env}
          size={size}
          variant={variant}
          clickable={Boolean(onEnvironmentClick)}
          onClick={() => onEnvironmentClick?.(env)}
        />
      ))}
    </>
  );
}

export default EnvironmentChip;