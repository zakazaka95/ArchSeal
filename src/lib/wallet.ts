import { CHAIN_ID_HEX, RPC_URL, EXPLORER_URL } from "./genlayer";

export type Eip1193 = {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
  on?: (event: string, cb: (...a: unknown[]) => void) => void;
  removeListener?: (event: string, cb: (...a: unknown[]) => void) => void;
};

interface InjectedProvider extends Eip1193 {
  providers?: Eip1193[];
  isMetaMask?: boolean;
}

export function getEthereum(): Eip1193 | null {
  if (typeof window === "undefined") return null;
  const injected = (window as { ethereum?: InjectedProvider }).ethereum;
  if (!injected) return null;
  return (
    (injected.providers?.find((p: InjectedProvider) => p?.isMetaMask) as Eip1193) ??
    (injected as Eip1193)
  );
}

export function getWalletProvider(): Eip1193 {
  const provider = getEthereum();
  if (!provider) throw new Error("NO_WALLET");
  return provider;
}

/** Standard EIP-1193 connect + network guarantee. Never touches MetaMask Snaps. */
export async function ensureBradburyNetwork(): Promise<{
  provider: Eip1193;
  address: `0x${string}`;
}> {
  const provider = getWalletProvider();
  await provider.request({ method: "eth_requestAccounts" });
  await switchToBradbury();
  const accounts = await provider.request({ method: "eth_accounts" });
  if (!Array.isArray(accounts) || !accounts[0]) throw new Error("Wallet account is not connected.");
  return { provider, address: accounts[0] as `0x${string}` };
}

export async function requestAccounts(): Promise<string> {
  const eth = getEthereum();
  if (!eth) throw new Error("NO_WALLET");
  const accounts = await eth.request({ method: "eth_requestAccounts" });
  if (!Array.isArray(accounts) || !accounts.length)
    throw new Error("No wallet account was authorized.");
  return accounts[0]!;
}

export async function getChainId(): Promise<string | null> {
  const eth = getEthereum();
  if (!eth) return null;
  try {
    return (await eth.request({ method: "eth_chainId" })) as string | null;
  } catch {
    return null;
  }
}

export function isBradbury(chainId: string | null) {
  return !!chainId && chainId.toLowerCase() === CHAIN_ID_HEX.toLowerCase();
}

export async function switchToBradbury(): Promise<void> {
  const eth = getEthereum();
  if (!eth) throw new Error("NO_WALLET");
  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CHAIN_ID_HEX }],
    });
  } catch (err: unknown) {
    const e = err as { code?: number; message?: string };
    if (e?.code === 4902 || /unrecognized chain/i.test(e?.message ?? "")) {
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: CHAIN_ID_HEX,
            chainName: "GenLayer Bradbury Testnet",
            nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
            rpcUrls: [RPC_URL],
            blockExplorerUrls: [EXPLORER_URL],
          },
        ],
      });
      return;
    }
    throw err;
  }
}

export function toWei(amount: string): bigint {
  const value = (amount ?? "").trim();
  if (!value) return 0n;
  if (!/^\d*(\.\d*)?$/.test(value)) throw new Error("Enter a valid GEN amount.");
  const [whole, frac = ""] = value.split(".");
  const padded = (frac + "0".repeat(18)).slice(0, 18);
  return BigInt(whole || "0") * 10n ** 18n + BigInt(padded || "0");
}

export function formatGen(wei: string | bigint): string {
  let v: bigint;
  try {
    v = BigInt(wei || 0);
  } catch {
    return "0";
  }
  if (v === 0n) return "0";
  const whole = v / 10n ** 18n;
  const frac = (v % 10n ** 18n).toString().padStart(18, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac.slice(0, 6)}` : whole.toString();
}

export function shortHash(h: string, size = 7) {
  if (!h) return "—";
  return h.length <= size * 2 + 2 ? h : `${h.slice(0, size)}…${h.slice(-4)}`;
}

export function shortAddress(a: string) {
  if (!a) return "—";
  return a.length <= 12 ? a : `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function describeWalletError(err: unknown): string {
  const e = err as { code?: number; message?: string };
  const msg = String(e?.message ?? e ?? "Unknown error");
  if (e?.code === 4001 || /user rejected|user denied/i.test(msg))
    return "Transaction rejected in your wallet.";
  if (msg === "NO_WALLET" || /no wallet/i.test(msg))
    return "No browser wallet detected. Install an EVM wallet extension to sign.";
  if (/insufficient funds/i.test(msg))
    return "Insufficient GEN balance to cover the reward and gas on Bradbury.";
  if (/timeout|timed out/i.test(msg))
    return "The Bradbury RPC timed out. The transaction may still settle — reload to check.";
  return msg;
}
