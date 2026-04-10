"use client";

import {
  CheckCircle2,
  AlertCircle,
  Info,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  UNSTABLE_ToastQueue as ToastQueue,
  UNSTABLE_ToastRegion as ToastRegion,
  UNSTABLE_Toast as Toast,
  Button,
} from "react-aria-components";

export type ToastVariant = "success" | "error" | "info";

export interface ToastContent {
  title: string;
  description?: string;
  variant: ToastVariant;
}

const TOAST_CONFIG: Record<
  ToastVariant,
  {
    icon: LucideIcon;
    iconClassName: string;
  }
> = {
  success: {
    icon: CheckCircle2,
    iconClassName: "toast-icon toast-icon--success",
  },
  error: {
    icon: AlertCircle,
    iconClassName: "toast-icon toast-icon--error",
  },
  info: {
    icon: Info,
    iconClassName: "toast-icon toast-icon--info",
  },
};

export const toastQueue = new ToastQueue<ToastContent>({
  maxVisibleToasts: 4,
});

export function addToast(content: ToastContent, timeout = 6000) {
  toastQueue.add(content, { timeout });
}

function ToastIcon({ variant }: { variant: ToastVariant }) {
  const { icon: Icon, iconClassName } = TOAST_CONFIG[variant];
  return <Icon size={16} className={iconClassName} aria-hidden="true" />;
}

export function AppToasts() {
  return (
    <ToastRegion queue={toastQueue} className="toast-region">
      {({ toast }) => {
        const { title, description, variant } = toast.content;

        return (
          <Toast toast={toast} className={`app-toast app-toast--${variant}`}>
            <ToastIcon variant={variant} />

            <div className="app-toast-body">
              <strong className="app-toast-title">{title}</strong>
              {description ? (
                <p className="app-toast-desc">{description}</p>
              ) : null}
            </div>

            <Button
              slot="close"
              className="app-toast-close"
              aria-label="Cerrar notificación"
            >
              <X size={14} />
            </Button>
          </Toast>
        );
      }}
    </ToastRegion>
  );
}
