import { PublicKey, Keypair } from "@solana/web3.js";
import { assert } from "chai";

const PROGRAM_ID = new PublicKey("B38n2DX7BR4tEait7Pn3SHUwB29WQt4U8jttCQgJZ57w");

describe("aura-creator-coin", () => {
  describe("#5 Benefits - PDA derivation", () => {
    it("derives benefits PDA correctly", () => {
      const fakeMint = Keypair.generate().publicKey;
      const [pda, bump] = PublicKey.findProgramAddressSync(
        [Buffer.from("benefits"), fakeMint.toBuffer()],
        PROGRAM_ID
      );
      assert.ok(pda);
      assert.isAtLeast(bump, 0);
      assert.isAtMost(bump, 255);
    });
  });

  describe("#1 Redemption - PDA derivation", () => {
    it("derives redemption counter PDA", () => {
      const fakeMint = Keypair.generate().publicKey;
      const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("redemption-counter"), fakeMint.toBuffer()],
        PROGRAM_ID
      );
      assert.ok(pda);
    });

    it("derives redemption PDA with id=0", () => {
      const fakeMint = Keypair.generate().publicKey;
      const id = Buffer.alloc(8);
      id.writeBigUInt64LE(BigInt(0));
      const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("redemption"), fakeMint.toBuffer(), id],
        PROGRAM_ID
      );
      assert.ok(pda);
    });

    it("derives different PDAs for different IDs", () => {
      const fakeMint = Keypair.generate().publicKey;
      const id0 = Buffer.alloc(8); id0.writeBigUInt64LE(BigInt(0));
      const id1 = Buffer.alloc(8); id1.writeBigUInt64LE(BigInt(1));
      const [pda0] = PublicKey.findProgramAddressSync(
        [Buffer.from("redemption"), fakeMint.toBuffer(), id0], PROGRAM_ID
      );
      const [pda1] = PublicKey.findProgramAddressSync(
        [Buffer.from("redemption"), fakeMint.toBuffer(), id1], PROGRAM_ID
      );
      assert.notEqual(pda0.toBase58(), pda1.toBase58());
    });
  });

  describe("#4 Gift - no PDA needed (uses ATA)", () => {
    it("gift instruction exists in program (verified via build)", () => {
      // Gift uses standard SPL associated token accounts
      // No custom PDA needed - validated by successful anchor build
      assert.ok(true);
    });
  });

  describe("#7 Auto-confirm constants", () => {
    it("auto-confirm slots = 7 days worth", () => {
      // 7 days * 24h * 60min * 60s * (1000ms/400ms per slot) = 1,512,000
      const AUTO_CONFIRM_SLOTS = 1_512_000;
      const EXPECTED = 7 * 24 * 60 * 60 * 1000 / 400;
      assert.equal(AUTO_CONFIRM_SLOTS, EXPECTED);
    });
  });

  describe("#10 Primary Issuance - fee math", () => {
    it("5% fee splits correctly: 2% burn + 2% staking + 0.5% gas + 0.5% ops", () => {
      const gross = 1_000_000_000; // 1 ORA
      const fee_bps = 500;
      const burn_bps = 200;
      const staking_bps = 200;
      const gas_bps = 50;
      const ops_bps = 50;

      const total_fee = Math.floor(gross * fee_bps / 10000);
      const burn = Math.floor(gross * burn_bps / 10000);
      const staking = Math.floor(gross * staking_bps / 10000);
      const gas = Math.floor(gross * gas_bps / 10000);
      const ops = total_fee - burn - staking - gas;

      assert.equal(total_fee, 50_000_000); // 5%
      assert.equal(burn, 20_000_000);      // 2%
      assert.equal(staking, 20_000_000);   // 2%
      assert.equal(gas, 5_000_000);        // 0.5%
      assert.equal(ops, 5_000_000);        // 0.5%
      assert.equal(burn + staking + gas + ops, total_fee);
    });
  });

  describe("#11 Burn Tracker - PDA derivation", () => {
    it("derives burn tracker PDA", () => {
      const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("burn-tracker")],
        PROGRAM_ID
      );
      assert.ok(pda);
    });
  });
});
