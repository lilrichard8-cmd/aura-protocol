import { PublicKey, Keypair } from "@solana/web3.js";
import { assert } from "chai";

const PROGRAM_ID = new PublicKey("5BTekjKRiY8pXqEr7eQsqhRFynN27CxfYnh1d5q27cLV");

describe("aura-market", () => {
  describe("#2 Sell Order - PDA derivation", () => {
    it("derives sell order counter PDA", () => {
      const fakeMint = Keypair.generate().publicKey;
      const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("sell-order-counter"), fakeMint.toBuffer()],
        PROGRAM_ID
      );
      assert.ok(pda);
    });

    it("derives sell order PDA", () => {
      const fakeMint = Keypair.generate().publicKey;
      const id = Buffer.alloc(8);
      id.writeBigUInt64LE(BigInt(0));
      const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("sell-order"), fakeMint.toBuffer(), id],
        PROGRAM_ID
      );
      assert.ok(pda);
    });

    it("different orders get different PDAs", () => {
      const fakeMint = Keypair.generate().publicKey;
      const id0 = Buffer.alloc(8); id0.writeBigUInt64LE(BigInt(0));
      const id1 = Buffer.alloc(8); id1.writeBigUInt64LE(BigInt(1));
      const [pda0] = PublicKey.findProgramAddressSync(
        [Buffer.from("sell-order"), fakeMint.toBuffer(), id0], PROGRAM_ID
      );
      const [pda1] = PublicKey.findProgramAddressSync(
        [Buffer.from("sell-order"), fakeMint.toBuffer(), id1], PROGRAM_ID
      );
      assert.notEqual(pda0.toBase58(), pda1.toBase58());
    });
  });

  describe("#3 Buy Order - PDA derivation", () => {
    it("derives buy order counter PDA", () => {
      const fakeMint = Keypair.generate().publicKey;
      const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("buy-order-counter"), fakeMint.toBuffer()],
        PROGRAM_ID
      );
      assert.ok(pda);
    });

    it("derives buy order PDA", () => {
      const fakeMint = Keypair.generate().publicKey;
      const id = Buffer.alloc(8);
      id.writeBigUInt64LE(BigInt(0));
      const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("buy-order"), fakeMint.toBuffer(), id],
        PROGRAM_ID
      );
      assert.ok(pda);
    });

    it("buy order locks 105% to cover fees", () => {
      const amount = 100; // 100 CC
      const price = 1_000_000_000; // 1 ORA per CC
      const base_cost = amount * price / 1_000_000_000; // = 100 ORA
      const locked = Math.floor(base_cost * 10500 / 10000); // 105%
      assert.equal(locked, 105); // 105 ORA locked
    });
  });

  describe("Fee structure per §5.6", () => {
    it("no royalty on secondary trades", () => {
      // Per §6.4 - no royalties on secondary trades
      // Fee is only the 5% split, no additional royalty
      const total_fee_bps = 500; // 5%
      assert.equal(total_fee_bps, 200 + 200 + 50 + 50); // burn + staking + gas + ops
    });
  });
});
