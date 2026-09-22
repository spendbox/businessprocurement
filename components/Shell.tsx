"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import dynamic from "next/dynamic";

/** The forms are heavy and never needed on first paint — load them on demand. */
const OrderForm = dynamic(() => import("./OrderForm").then((m) => m.OrderForm));
const VendorForm = dynamic(() => import("./VendorForm").then((m) => m.VendorForm));

export type Prefill = {
  need?: string;
  categories?: string[];
  /** Filled in for a signed-in business so they do not retype themselves. */
  company?: string;
  contactName?: string;
  email?: string;
};

type ShellValue = {
  openOrder: (prefill?: Prefill) => void;
  openVendor: () => void;
  docked: boolean;
  setDocked: (docked: boolean) => void;
  anyOpen: boolean;
};

const Ctx = createContext<ShellValue | null>(null);

export function useShell(): ShellValue {
  const value = useContext(Ctx);
  if (!value) throw new Error("useShell must be used inside <Shell>");
  return value;
}

export function Shell({ children }: { children: ReactNode }) {
  const [orderOpen, setOrderOpen] = useState(false);
  const [vendorOpen, setVendorOpen] = useState(false);
  const [prefill, setPrefill] = useState<Prefill>({});
  const [docked, setDocked] = useState(false);

  const openOrder = useCallback((next?: Prefill) => {
    setPrefill(next ?? {});
    setOrderOpen(true);
  }, []);

  const openVendor = useCallback(() => setVendorOpen(true), []);

  const value = useMemo<ShellValue>(
    () => ({
      openOrder,
      openVendor,
      docked,
      setDocked,
      anyOpen: orderOpen || vendorOpen,
    }),
    [openOrder, openVendor, docked, orderOpen, vendorOpen],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {orderOpen && (
        <OrderForm
          open={orderOpen}
          onClose={() => setOrderOpen(false)}
          prefill={prefill}
        />
      )}
      {vendorOpen && (
        <VendorForm open={vendorOpen} onClose={() => setVendorOpen(false)} />
      )}
    </Ctx.Provider>
  );
}
