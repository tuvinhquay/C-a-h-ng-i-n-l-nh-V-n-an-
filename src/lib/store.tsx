/**
 * Trạng thái ứng dụng: đọc IndexedDB một lần, mỗi thao tác ghi xong thì cập nhật bộ nhớ.
 * Giao diện không giữ bản sao lệch với kho trên máy.
 */

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  cancelRepair,
  defaultSettings,
  issueRepairInvoice,
  issueSale,
  importBackup,
  loadSnapshot,
  patchDoneRepair,
  postStock,
  removeCustomer,
  removePart,
  removeQuote,
  removeRepair,
  saveCustomer,
  savePart,
  saveQuote,
  saveRepair,
  saveSettings,
  voidInvoice,
} from "@/lib/db";
import type {
  Customer,
  CustomerInput,
  Invoice,
  Part,
  PartInput,
  Quote,
  QuoteInput,
  Repair,
  RepairInput,
  SaleInput,
  Settings,
  Snapshot,
  StockMove,
} from "@/lib/types";

interface ShopApi {
  ready: boolean;
  error: string | null;
  settings: Settings;
  parts: Part[];
  moves: StockMove[];
  customers: Customer[];
  repairs: Repair[];
  quotes: Quote[];
  invoices: Invoice[];
  reload: () => Promise<void>;
  savePart: (input: PartInput, id?: string) => Promise<Part>;
  removePart: (id: string) => Promise<void>;
  postStock: (input: { partId: string; mode: "in" | "out" | "count"; qty: number; note: string }) => Promise<StockMove | null>;
  saveCustomer: (input: CustomerInput, id?: string) => Promise<Customer>;
  removeCustomer: (id: string) => Promise<void>;
  saveRepair: (id: string | null, input: RepairInput, complete: boolean) => Promise<Repair>;
  patchDoneRepair: (id: string, input: RepairInput) => Promise<Repair>;
  removeRepair: (id: string) => Promise<void>;
  cancelRepair: (id: string) => Promise<void>;
  saveQuote: (id: string | null, input: QuoteInput) => Promise<Quote>;
  removeQuote: (id: string) => Promise<void>;
  issueSale: (input: SaleInput) => Promise<Invoice>;
  issueRepairInvoice: (repairId: string, input: { note: string; lines: Repair["lines"] }) => Promise<Invoice>;
  voidInvoice: (id: string) => Promise<void>;
  saveSettings: (patch: Partial<Settings>) => Promise<void>;
  markBackup: () => Promise<Settings>;
  restore: (raw: unknown) => Promise<void>;
}

const ShopContext = createContext<ShopApi | null>(null);

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const index = list.findIndex((entry) => entry.id === item.id);
  if (index === -1) return [item, ...list];
  const next = list.slice();
  next[index] = item;
  return next;
}

export function ShopProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot>({
    settings: defaultSettings(),
    parts: [],
    moves: [],
    customers: [],
    repairs: [],
    quotes: [],
    invoices: [],
  });

  const apply = (next: Snapshot) => setSnapshot(next);

  const reload = async () => {
    apply(await loadSnapshot());
  };

  useEffect(() => {
    let alive = true;
    loadSnapshot()
      .then((next) => {
        if (alive) {
          apply(next);
          setReady(true);
        }
      })
      .catch((reason: unknown) => {
        if (!alive) return;
        setError(reason instanceof Error ? reason.message : "Không mở được sổ trên máy này.");
        setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const api = useMemo<ShopApi>(() => {
    return {
      ready,
      error,
      ...snapshot,
      reload,
      async savePart(input, id) {
        const part = await savePart(input, id);
        const fresh = await loadSnapshot();
        apply(fresh);
        return part;
      },
      async removePart(id) {
        await removePart(id);
        setSnapshot((current) => ({ ...current, parts: current.parts.filter((item) => item.id !== id) }));
      },
      async postStock(input) {
        const result = await postStock(input);
        const fresh = await loadSnapshot();
        apply(fresh);
        return result.move;
      },
      async saveCustomer(input, id) {
        const customer = await saveCustomer(input, id);
        setSnapshot((current) => ({ ...current, customers: upsert(current.customers, customer).sort((a, b) => a.name.localeCompare(b.name, "vi")) }));
        return customer;
      },
      async removeCustomer(id) {
        await removeCustomer(id);
        setSnapshot((current) => ({ ...current, customers: current.customers.filter((item) => item.id !== id) }));
      },
      async saveRepair(id, input, complete) {
        const { repair, customer } = await saveRepair(id, input, complete);
        const fresh = await loadSnapshot();
        apply(fresh);
        void customer;
        return repair;
      },
      async patchDoneRepair(id, input) {
        const { repair } = await patchDoneRepair(id, input);
        const fresh = await loadSnapshot();
        apply(fresh);
        return repair;
      },
      async removeRepair(id) {
        await removeRepair(id);
        setSnapshot((current) => ({ ...current, repairs: current.repairs.filter((item) => item.id !== id) }));
      },
      async cancelRepair(id) {
        await cancelRepair(id);
        const fresh = await loadSnapshot();
        apply(fresh);
      },
      async saveQuote(id, input) {
        const quote = await saveQuote(id, input);
        setSnapshot((current) => ({
          ...current,
          quotes: upsert(current.quotes, quote).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
        }));
        return quote;
      },
      async removeQuote(id) {
        await removeQuote(id);
        setSnapshot((current) => ({ ...current, quotes: current.quotes.filter((item) => item.id !== id) }));
      },
      async issueSale(input) {
        const invoice = await issueSale(input);
        const fresh = await loadSnapshot();
        apply(fresh);
        return invoice;
      },
      async issueRepairInvoice(repairId, input) {
        const invoice = await issueRepairInvoice(repairId, input);
        const fresh = await loadSnapshot();
        apply(fresh);
        return invoice;
      },
      async voidInvoice(id) {
        await voidInvoice(id);
        const fresh = await loadSnapshot();
        apply(fresh);
      },
      async saveSettings(patch) {
        const settings = await saveSettings(patch);
        setSnapshot((current) => ({ ...current, settings }));
      },
      async markBackup() {
        const settings = await saveSettings({ lastBackupAt: new Date().toISOString() });
        setSnapshot((current) => ({ ...current, settings }));
        return settings;
      },
      async restore(raw) {
        const next = await importBackup(raw);
        apply(next);
      },
    };
  }, [ready, error, snapshot]);

  return <ShopContext.Provider value={api}>{children}</ShopContext.Provider>;
}

export function useShop(): ShopApi {
  const value = useContext(ShopContext);
  if (!value) throw new Error("useShop phải nằm trong ShopProvider.");
  return value;
}
