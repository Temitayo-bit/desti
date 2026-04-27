# Desti Knowledge Pack

> Loaded by the chat gateway. Use only this pack plus the user’s question to answer. Stay within Stetson / Desti campus transport topics.

---

## App overview

Desti is a campus transport web app for **verified Stetson University students**. It helps **drivers** post rides with empty seats and **riders** find rides or post **trip requests** so drivers can respond with **offers**. After a **booking** is confirmed, riders and drivers can **message each other in-app** to coordinate pickup and details.

---

## Who can use Desti

- You need a **verified email address** that ends in **`@stetson.edu`**.
- If you are not verified or you use a non-Stetson email, you’ll see **Access Restricted** until you fix your account or verify the right address.

---

## First-time setup: onboarding

- After you sign in with a verified Stetson email, you may be sent to **Onboarding** before the rest of the app works.
- You’ll provide: **name**, **age**, **year at Stetson** (Freshman–Senior), and **gender**.
- **Onboarding is one-time.** Once it’s completed, you’re taken to the **Dashboard** and can use rides, trip requests, bookings, and messages.

---

## Main navigation (sidebar)

After you’re in the app, the sidebar includes:

| Link | What it is |
|------|------------|
| **Dashboard** | Overview of your upcoming driving rides, confirmed trips, and pending offers. |
| **Rides** | Browse and post **rides** (driver offers a route and seats). |
| **Trip Requests** | Browse and post **trip requests** (rider asks for a ride; drivers send offers). |
| **Messages** | **Direct message threads** tied to a **booking** or an **offer** (not a general campus inbox). |
| **Profile** | Your Desti profile (name, email, year, age, gender). Links to **Clerk** account and **Sign out**. |

**URLs (for “where do I go?”):** `/dashboard`, `/browse`, `/browse-trip-requests`, `/messages`, `/profile`.

---

## Rides (drivers and riders)

### Post a ride (driver)

1. Open **Rides** and use **Post a Ride** (or go to `/post-ride`).
2. Enter **origin** and **destination** (short text locations).
3. Set an **earliest** and **latest departure** time (your departure window).
4. Choose **distance**: SHORT, MEDIUM, or LONG.
5. Set **price** (in dollars in the form; the app stores it accurately for you).
6. Set **how many seats** you’re offering (within the limits shown in the form).
7. Optionally add **pickup** and **dropoff** instructions.
8. Submit. You’ll typically be sent back to the **Dashboard** after success.

**Rules you should know:**

- The **departure window** (latest minus earliest) can’t be longer than **48 hours**.
- Times can’t be far in the past (there is a small grace for clock skew).
- Your ride stays **ACTIVE** until you cancel it or its departure window passes.

### Browse and book a ride (rider)

1. Open **Rides** (`/browse`).
2. Use search and **quick filters** (e.g. soon, later, more seats, shorter trips) to narrow the list.
3. Open a ride to see details, choose **how many seats** you need (if available), and **book**.
4. You **cannot book your own ride**.
5. You can only have **one confirmed booking per ride** as a rider.

### Edit or cancel a ride (driver, owner only)

- You can **edit** route, times, price, seats, and instructions **only while the ride has no confirmed bookings**—once someone has a **confirmed** booking, editing is blocked; cancel the ride or work with riders via **Messages** if needed.
- You can **cancel** your ride **before** the latest departure time has passed. Cancelling sets the ride to cancelled and **cancels confirmed bookings** tied to that ride.

**“My rides” view:** from **Rides**, switch to the **My rides** view (same area as browse; URL uses `?view=my`) to manage rides you’ve posted.

---

## Trip requests (riders and drivers)

### Post a trip request (rider)

1. Open **Trip Requests** and **Post a Trip Request** (`/post-trip-request`).
2. Enter **origin** and **destination**.
3. Set **earliest** and **latest** desired departure (your time window).
4. Choose **distance** and **how many seats** you need.
5. Optionally add pickup/dropoff notes.
6. Submit. The request is **ACTIVE** until it’s matched or closed.

**Rules:**

- Same kind of **48-hour window** and “not in the past” rules apply as for rides.
- While **ACTIVE** and **without a confirmed booking**, you can **edit** your request.
- If your request is **no longer active** (for example, closed after accepting an offer), you **cannot** edit it.

### Browse trip requests and send an offer (driver)

1. Open **Trip Requests** (`/browse-trip-requests`).
2. Open a request and **send an offer**: number of **seats**, **price**, and an optional short **message** to the rider.
3. You **cannot** send an offer on **your own** request.
4. You can only have **one active offer** (pending or accepted) **per** trip request as a driver—if you already have one, send an update by cancelling the old offer first (when allowed).

### Accept or decline offers (rider)

- Go to **Pending Offers** (`/offers`) or use links from the **Dashboard**.
- **Accept** an offer: this creates a **confirmed booking**, **closes** the trip request, and **declines/cancels** other pending offers on that request.
- **Decline**: uses cancel on that offer so you can consider other drivers.

### Cancel an offer (driver or rider)

- **Pending** offers can be cancelled by the **driver** (withdraw offer) or handled from the rider side via **Decline** on `/offers`.
- If an offer was **already accepted**, cancellation behaves like undoing that match: the linked **booking** is cancelled and the **trip request** can become **active** again when the system allows (see in-app messages if something fails).

**“My trip requests”:** from **Trip Requests**, use the **My** view (`/browse-trip-requests?view=my`) for requests you posted.

---

## Bookings

- A **booking** is **CONFIRMED** after:
  - you **book seats on someone’s ride**, or
  - you **accept a driver’s offer** on your trip request.
- **Upcoming trips:** open **Your Upcoming Trips** (`/bookings`) to see confirmed trips where you’re the rider or driver, with times and route summary.
- **Cancel as a rider (passenger):** you can cancel **your** booking; if it was for a **ride**, seats are **returned** to the driver’s ride so someone else can book.

---

## Messages (in-app coordination)

**Where:** **Messages** in the sidebar (`/messages`).

**What it is:**

- **Conversation threads** between you and the **other student** on a trip (**driver ↔ rider**).
- Each thread is linked to a **confirmed booking** and/or an **offer** record in the app. Your **Messages** list can include both types when they exist.
- Threads show **trip context** (like destination and date) and **chat history**. New messages are limited to **1000 characters** each.

**How to open a thread:**

- The usual path is from **Dashboard** or **Your Upcoming Trips** (`/bookings`): use the **message** action on a **confirmed booking** to open or create that booking’s thread.
- Threads tied to **pending or accepted offers** are also supported; they appear in **Messages** once that offer conversation exists (the same messaging system is used for both offers and bookings).

**Not the same as:** the **Desti help chat** (this assistant). Help chat answers how-to questions; **Messages** is for coordinating real trips with other users.

---

## Dashboard

The **Dashboard** summarizes what needs your attention:

- **Rides you’re driving** that are still upcoming.
- **Confirmed bookings** where you’re rider or driver (ride-based or trip-request-based), for trips still in the future.
- **Pending offers you’ve sent** and **pending offers you’ve received** (for active trip requests).

Counts may show totals; short lists may be **truncated**—use **Rides**, **Trip Requests**, **Offers**, or **Bookings** for full detail.

**Related pages:**

- **Pending Offers:** `/offers`
- **Your Upcoming Trips:** `/bookings`

---

## Profile and account

- **Profile** (`/profile`) shows the information Desti stores for you and links to **manage your Clerk account** and **sign out**.
- You need **completed onboarding** to reach Profile from the normal flow.

---

## FAQ

**Q: Who can sign in?**  
A: Students who can verify a **`@stetson.edu`** email in Clerk.

**Q: Why am I stuck on onboarding or “access restricted”?**  
A: You need a **verified Stetson email** and, for the main app, **finished onboarding**.

**Q: Where are my messages with another student?**  
A: **Messages** in the sidebar (`/messages`). Threads are tied to a **booking** or **offer**, not a separate “mail” app.

**Q: How do I book a seat?**  
A: **Rides** → pick a listing → **Book** with the number of seats you need.

**Q: How do I get a driver to pick me up?**  
A: **Post a Trip Request**, then review **offers** on `/offers` or the **Dashboard** and **accept** one.

**Q: Can I edit my ride or request after someone books?**  
A: **No**—once there is a **confirmed booking**, edits are locked. Cancel and recreate, or coordinate in **Messages** when appropriate.

**Q: How do I cancel?**  
A: As a **rider**, cancel **your booking**. As a **driver**, cancel **your ride** (before departure) or cancel a **pending offer** you sent. Exact buttons appear on the relevant cards and detail views.

**Q: Why can’t I book my own ride?**  
A: **Self-booking isn’t allowed**—bookings are for other passengers only.

**Q: Can I delete a trip request from the app?**  
A: **Trip-request deletion isn’t available** as a finished feature in the current app; manage the request by **editing** while it’s active without bookings, or by **closing** it through offers/bookings as the flows allow.
