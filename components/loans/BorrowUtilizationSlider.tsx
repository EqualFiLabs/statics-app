import { PercentageSlider } from "@/components/protocol/PercentageSlider";

export function BorrowUtilizationSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <PercentageSlider
      value={value}
      onChange={onChange}
      label="Use of available borrowed principal"
    />
  );
}
