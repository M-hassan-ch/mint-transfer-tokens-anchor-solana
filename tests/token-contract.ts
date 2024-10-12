import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenContract } from "../target/types/token_contract";
import { createAssociatedTokenAccountInstruction, createInitializeMintInstruction, getAssociatedTokenAddress, MINT_SIZE, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { expect } from "chai";

describe("token-contract", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.TokenContract as Program<TokenContract>;
  const mintKey: anchor.web3.Keypair = anchor.web3.Keypair.generate();
  let associatedTokenAccount = undefined;

  it("Mint a token", async () => {
    const adminPublicKey = anchor.AnchorProvider.env().wallet.publicKey;
    const lamports: number = await program.provider.connection.getMinimumBalanceForRentExemption(
      MINT_SIZE
    );

    associatedTokenAccount = await getAssociatedTokenAddress(
      mintKey.publicKey,
      adminPublicKey
    );

    const mint_tx = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.createAccount({
        fromPubkey: adminPublicKey,
        newAccountPubkey: mintKey.publicKey,
        space: MINT_SIZE,
        programId: TOKEN_PROGRAM_ID,
        lamports,
      }),
      createInitializeMintInstruction(
        mintKey.publicKey, 0, adminPublicKey, adminPublicKey
      ),
      createAssociatedTokenAccountInstruction(
        adminPublicKey, associatedTokenAccount, adminPublicKey, mintKey.publicKey
      )
    );

    const res = await anchor.AnchorProvider.env().sendAndConfirm(mint_tx, [mintKey]);

    console.log(
      await program.provider.connection.getParsedAccountInfo(adminPublicKey)
    );

    console.log("Account: ", res);
    console.log("Mint key: ", mintKey.publicKey.toString());
    console.log("User: ", adminPublicKey.toString());

    await program.methods.mintToken().accounts({
      mint: mintKey.publicKey,
      tokenAccount: associatedTokenAccount,
      authority: adminPublicKey,
    }).rpc();

    const minted = (await program.provider.connection.getParsedAccountInfo(associatedTokenAccount)).value.data?.parsed.info.tokenAmount.amount;
    expect(Number(minted)).to.be.deep.equals(10);
  });


  it("Transfer token", async () => {
    const myWallet = anchor.AnchorProvider.env().wallet.publicKey;
    const toWallet: anchor.web3.Keypair = anchor.web3.Keypair.generate();
    const toATA = await getAssociatedTokenAddress(
      mintKey.publicKey,
      toWallet.publicKey
    );

    const mint_tx = new anchor.web3.Transaction().add(
      createAssociatedTokenAccountInstruction(
        myWallet, toATA, toWallet.publicKey, mintKey.publicKey
      )
    );

    await anchor.AnchorProvider.env().sendAndConfirm(mint_tx, []);

    await program.methods.transferToken().accounts({
      from: associatedTokenAccount,
      authority: myWallet,
      to: toATA,
    }).rpc();

    
    const minted = (await program.provider.connection.getParsedAccountInfo(associatedTokenAccount)).value.data.parsed.info.tokenAmount.amount;
    expect(Number(minted)).to.deep.equal(7);
  });
});
