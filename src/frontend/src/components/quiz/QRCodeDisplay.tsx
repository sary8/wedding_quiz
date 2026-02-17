import { QRCodeSVG } from "qrcode.react";
import { Card } from "../ui/Card";

type Props = {
  value: string;
  size?: number;
  label?: string;
};

export function QRCodeDisplay({ value, size = 200, label = "参加用QRコード" }: Props) {
  return (
    <Card padding="md" className="bg-white">
      <div role="img" aria-label={label} className="flex flex-col items-center gap-2">
        <QRCodeSVG value={value} size={size} />
        {label && <p className="text-sm text-gray-600 text-center mt-2">{label}</p>}
      </div>
    </Card>
  );
}
