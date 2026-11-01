# Ember encryption plan (for Michael's decision)

**Goal:** limits, desires, health notes, triggers, overwhelm plans, scene plans, Top observations, debriefs and messages are locked on the phone before they're uploaded. The server stores locked boxes it cannot open. That protects people even if the server is hacked, subpoenaed, or a Supabase employee looks.

**Tool:** libsodium, a free, widely used and independently reviewed encryption library (ISC license). No homemade crypto.

## How it works, in plain terms

1. **Your keys live on your phone.** When you create an account, your phone makes a pair of keys: a private key (only you have it) and a public key (anyone can use it to lock something *for* you).
2. **Your password protects your private key.** Your phone turns your password into two separate secrets: one to sign in, and one to unlock your private key. The server only ever sees the first, so it can never unlock your data.
3. **Your recovery code is the spare key.** At sign-up, Ember shows a 24-character recovery code once. You write it down or save it in a password manager.

## Sharing with a connection

- A bottom's profile is locked with its own key. When the bottom shares with a Top, their phone locks a copy of that key with the Top's public key. Only that Top's phone can open it.
- Each connection has a shared key for things both people see: messages, SceneVibes, shared plans and debriefs.
- A Top's private observations are locked with the Top's own key only, so the bottom and the server can't read them. A switch's Top notes never mix with their own bottom profile.
- **Plan privacy is kept:** the Top's full plan is locked with the Top's own key. "Send plan" gives the bottom a copy locked for them.

## Revoking access

- The bottom taps Revoke. Their phone makes a new profile key, relocks the profile, and re-shares it only with the connections that still have access. The revoked Top's copy of the key is deleted, and their phone deletes its saved copy the next time it connects.
- **Honest limit:** nothing can make a person forget what they already read, or undo a screenshot. Revoking stops all future access, including to every later update.

## Losing a phone or forgetting a password

| What happened | What you need | Result |
| --- | --- | --- |
| Lost or new phone, remember password | Sign in on the new phone | Everything comes back |
| Forgot password, have recovery code | Reset password by email, then enter code | Everything comes back |
| Forgot password, no recovery code | Reset password by email | You're back in, but your locked data is gone for good. You redo your profile, and connections re-share with you |

That last row is the price of real privacy: if Ember could recover the data without you, so could anyone who broke into Ember.

## Guest links (no account)

- The link holds a one-time key in the part after the "#", which browsers never send to any server.
- The guest's answers are locked on their device for the Top who invited them. Links expire after 7 days and work once.
- If the guest creates an account later, their answers move into their own locked profile.

## What the server can still see

Account emails, who is connected to whom, when things were created, that a scene exists and its date and time (needed to send the 18-hour check-in), and notification schedules. Notification text is always generic, so the server never needs to read content.

## Your decision

- **Recommended:** approve the plan as written (password unlocks everything, recovery code as backup, data lost without either).
- **Alternative:** Ember keeps a server-side backup it could restore without the code. That's friendlier, but it would mean the server can read sensitive data, which goes against the spec's privacy promise. I don't recommend it.
