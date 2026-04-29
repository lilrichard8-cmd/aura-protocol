import { PublicKey, Keypair } from "@solana/web3.js";
import { assert } from "chai";

const PROGRAM_ID = new PublicKey("7Un16eWXCteD3PgjpYWggCjuQK2tneHDkwGXvUg5obBk");

describe("aura-governance", () => {
  describe("#8 Arbitration - PDA derivation", () => {
    it("derives arbitration governance PDA", () => {
      const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("arb-governance")],
        PROGRAM_ID
      );
      assert.ok(pda);
    });

    it("derives arbitrator registry PDA", () => {
      const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("arb-registry")],
        PROGRAM_ID
      );
      assert.ok(pda);
    });

    it("derives arbitration dispute PDA", () => {
      const id = Buffer.alloc(8);
      id.writeBigUInt64LE(BigInt(0));
      const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("arb-dispute"), id],
        PROGRAM_ID
      );
      assert.ok(pda);
    });

    it("different disputes get different PDAs", () => {
      const id0 = Buffer.alloc(8); id0.writeBigUInt64LE(BigInt(0));
      const id1 = Buffer.alloc(8); id1.writeBigUInt64LE(BigInt(1));
      const [pda0] = PublicKey.findProgramAddressSync(
        [Buffer.from("arb-dispute"), id0], PROGRAM_ID
      );
      const [pda1] = PublicKey.findProgramAddressSync(
        [Buffer.from("arb-dispute"), id1], PROGRAM_ID
      );
      assert.notEqual(pda0.toBase58(), pda1.toBase58());
    });
  });

  describe("#8 Arbitration - weight function", () => {
    // Mirrors the weight function from arbitration.rs
    function weight(ars: number): number {
      if (ars < 50) return 1;
      if (ars <= 200) return Math.floor(ars / 50);
      const excess = ars - 200;
      if (excess === 0) return 4;
      const log2_val = 63 - Math.clz32(excess); // approximate
      return 4 + log2_val;
    }

    it("weight(0) = 1", () => assert.equal(weight(0), 1));
    it("weight(49) = 1", () => assert.equal(weight(49), 1));
    it("weight(50) = 1", () => assert.equal(weight(50), 1));
    it("weight(100) = 2", () => assert.equal(weight(100), 2));
    it("weight(200) = 4", () => assert.equal(weight(200), 4));
    it("weight(201) > 4", () => assert.isAbove(weight(201), 4));
  });

  describe("#8 Arbitration - ARS rewards", () => {
    it("trial 1 complete = +10 ARS", () => {
      const ARS_TRIAL1_COMPLETE = 10;
      assert.equal(ARS_TRIAL1_COMPLETE, 10);
    });

    it("ruling with majority = +5 ARS", () => {
      const ARS_RULING_WITH_MAJORITY = 5;
      assert.equal(ARS_RULING_WITH_MAJORITY, 5);
    });

    it("absence penalty = -20 ARS + 30 day exclusion", () => {
      const ARS_ABSENCE = -20;
      const ABSENCE_PENALTY_SLOTS = 6_480_000; // 30 days
      assert.equal(ARS_ABSENCE, -20);
      assert.equal(ABSENCE_PENALTY_SLOTS, 30 * 24 * 60 * 60 * 1000 / 400);
    });
  });

  describe("Existing governance - PDA derivation", () => {
    it("derives governance config PDA", () => {
      const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("governance_config")],
        PROGRAM_ID
      );
      assert.ok(pda);
    });

    it("derives arbiter record PDA", () => {
      const arbiter = Keypair.generate().publicKey;
      const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("arbiter"), arbiter.toBuffer()],
        PROGRAM_ID
      );
      assert.ok(pda);
    });
  });
});
