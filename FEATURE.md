# Feature: Paid Courses (Cart, Coupons, Bundles, Refunds, Instructor Revenue)

This page says WHAT we are building. It does not say how. HANDS-ON.md shows how to build it with Claude.

## The story

So far, every course in LearnHub is free. LearnHub now wants to start selling courses.

A student should be able to put paid courses in a cart, use a coupon, pay, and start learning.
If the student changes their mind early, they can get a refund.
Instructors should be able to see how much they earned.

## Who uses it

1. **Student.** Browses courses, fills a cart, uses a coupon, pays, sees orders, asks for a refund.
2. **Instructor.** Looks at how much each instructor has earned.
3. **Admin.** Owns the coupons. The coupons are fixed in the starting data. There is no coupon screen in this feature.

## The five parts

1. **Prices and cart.** Every course has a price. A student keeps many paid courses in a cart.
2. **Bundle.** Buy three or more paid courses in one order and get 15% off.
3. **Coupons.** A code that takes money off. Percent or fixed amount.
4. **Checkout and orders.** Pay, get enrolled, see your orders.
5. **Refunds and revenue.** Get your money back early. Instructors earn 70%.

## Starting data

Courses and prices:

| Id | Course | Category | Instructor | Price |
| --- | --- | --- | --- | --- |
| 1 | Intro to C# Programming | Programming | Maya Rao | Free |
| 2 | JavaScript for the Web | Programming | Liam Carter | 40.00 |
| 3 | UI Design Basics | Design | Sofia Alvarez | 30.00 |
| 4 | Data Analysis with SQL | Data | Ken Watanabe | 30.00 |
| 5 | Cloud Fundamentals | Cloud | Priya Nair | Free |
| 6 | Deploying Apps with Containers | Cloud | Omar Hassan | 60.00 |

Coupons:

| Code | Type | Value | Other rules |
| --- | --- | --- | --- |
| WELCOME10 | Percent | 10 | none |
| SAVE20 | Fixed | 20 | order must be at least 50.00 |
| CLOUD25 | Percent | 25 | Cloud courses only |
| FLAT50 | Fixed | 50 | none |
| OLD5 | Percent | 5 | already expired |

All coupons except OLD5 expire on 31 December 2099 and can be used many times in total.

## The rules

Prices and cart

- **R1.** Every course has a price of 0 or more. A price of 0 means free. At least two courses are free.
- **R2.** A free course is joined directly, as today. A paid course cannot be joined directly. It must be bought.
- **R3.** Each student has their own cart. It holds many paid courses. The student can see it, add to it and remove from it.
- **R4.** A free course cannot be put in the cart. The answer is 400 with a clear message.
- **R5.** A course the student already owns cannot be put in the cart. A course already in the cart cannot be added twice. Both answers are 409.

Bundle

- **R6.** If the cart has three or more paid courses, every line gets 15% off. With fewer than three, there is no bundle discount.

Coupons

- **R7.** A coupon is Percent or Fixed. The code does not care about upper or lower case. A coupon can name a category. Then it only takes money off courses in that category.
- **R8.** A coupon is refused, with a clear message, if the code is unknown, if it has expired, or if it has no uses left. A coupon works through its whole last day.
- **R9.** One student can use the same coupon only once. A refunded order does not count as a use.
- **R10.** The order of the maths is: first the bundle, then the coupon. A coupon's minimum order amount is checked after the bundle discount.
- **R11.** A category coupon looks only at the lines in its category. If the cart has no such line, the coupon is refused.
- **R12.** The total is never below 0. A fixed coupon never takes off more than the lines it applies to cost.
- **R13.** Money is rounded to two decimals. A half rounds up (0.005 becomes 0.01).

Checkout and orders

- **R14.** A preview shows the price of every line and the totals, for the cart and a coupon code. It changes nothing.
- **R15.** Checkout checks everything again. An empty cart is refused. A bad coupon is refused. A course the student now owns is refused. Each answer is 400 with a clear message.
- **R16.** A good checkout saves an order, counts one use of the coupon, enrolls the student in every course, and empties the cart. The answer is 201.
- **R17.** A student can list their own orders, newest first.

Refunds and revenue

- **R18.** A refund is allowed only if both are true: the order is at most 7 days old, and the student has finished less than 30% of every course in the order. If not, the answer is 400 with the reason. A second refund of the same order is 409. An unknown order is 404.
- **R19.** A refund sets the order to Refunded, removes the student's enrollments and progress for those courses, and gives the coupon use back.
- **R20.** Instructor revenue shows, for each instructor: gross sales, refunds, and the instructor share. The share is 70% of the sales that were not refunded.

## Worked examples

**1. Bundle then coupon.** A student buys courses 2, 3 and 4.

| Step | Amount |
| --- | --- |
| Prices: 40 + 30 + 30 | 100.00 |
| Bundle, 15% off | minus 15.00, leaves 85.00 |
| Coupon WELCOME10, 10% off 85.00 | minus 8.50 |
| Total | **76.50** |

Line by line, the coupon takes off 3.40, 2.55 and 2.55.

**2. A category coupon.** A student buys courses 2, 3 and 6, and uses CLOUD25.

1. Prices: 40 + 30 + 60 = 130.00.
2. Bundle, 15% off: minus 19.50. That leaves 110.50.
3. Only course 6 is a Cloud course. After the bundle it costs 51.00.
4. CLOUD25 takes 25% of 51.00, which is 12.75.
5. Total: 110.50 minus 12.75 = **97.75**.

**3. A coupon that would go below zero.** A student buys course 3 (30.00) and uses FLAT50 (50 off).
The coupon can take off at most 30.00. The total is **0.00**. It is never negative. The student is still enrolled.

**4. A minimum order amount.** A student buys only course 2 (40.00) and uses SAVE20. The order must be at least 50.00.
The coupon is refused. The message says the order needs at least 50.00.

**5. Minimum is checked after the bundle.** A coupon needs at least 90.00. The cart is courses 2, 3 and 4. The prices add up to 100.00.
After the bundle it is 85.00. The coupon is refused.

**6. A refund that is refused.** A student bought course 4 (5 lessons) and finished 2 lessons. That is 40%.
The limit is under 30%. The refund is refused with: "You have finished 40% of Data Analysis with SQL. Refunds need progress under 30% on every course."

**7. A refund that works.** A student bought courses 2, 3 and 4 with WELCOME10 and finished 1 lesson of course 4 (20%). It is day 2.
The refund works. The order is Refunded. The student is no longer enrolled in the three courses. The progress is gone. WELCOME10 can be used again by this student.

**8. Instructor revenue.** Liam Carter teaches course 2.
In example 1, his line cost the student 40.00 minus 6.00 (bundle) minus 3.40 (coupon) = 30.60.

| Event | Gross sales | Refunds | Instructor share (70% of net) |
| --- | --- | --- | --- |
| After the purchase | 30.60 | 0.00 | 21.42 |
| After a refund of that order | 30.60 | 30.60 | 0.00 |

## API

| Method and path | What it does | Answers |
| --- | --- | --- |
| `GET /api/courses` and `GET /api/courses/{id}` | As today, now with `price` | 200 |
| `POST /api/enrollments` | As today. A paid course is refused | 201, 400, 409 |
| `GET /api/cart?studentName=` | The student's cart | 200 |
| `POST /api/cart` with `studentName`, `courseId` | Add a paid course | 201, 400 (free or unknown), 409 (owned or in cart) |
| `DELETE /api/cart?studentName=&courseId=` | Remove a course | 204, 404 |
| `POST /api/checkout/preview` with `studentName`, optional `couponCode` | Price of the cart, line by line | 200 |
| `POST /api/checkout` with `studentName`, optional `couponCode` | Pay | 201, 400 |
| `GET /api/orders?studentName=` | The student's orders | 200 |
| `POST /api/orders/{id}/refund` | Refund an order | 200, 400, 404, 409 |
| `GET /api/instructors/revenue` | One row per instructor | 200 |

All errors have the body `{ "error": "message" }`. The message is plain English and safe to show to the student. Money is a number with up to 2 decimals. Field names are camelCase.

Shapes of the answers:

- **Course** (in `GET /api/courses` and `GET /api/courses/{id}`): the usual fields plus `price` (a number, 0 means free).
- **Cart item** (`GET /api/cart`, a list): `{ courseId, title, price, category, instructor }`.
- **Cart add** (`POST /api/cart`, 201): `{ studentName, courseId, addedAt }`.
- **Preview** (`POST /api/checkout/preview`, 200): `{ lines: [{ courseId, title, price, bundleDiscount, couponDiscount, final }], subtotal, bundleDiscount, couponDiscount, total, couponMessage }`. `couponMessage` is empty when no code was sent. If the code is refused, the discounts are 0 and `couponMessage` holds the reason. An empty cart gives an empty `lines` list.
- **Order** (`POST /api/checkout` 201, `GET /api/orders` a list, `POST /api/orders/{id}/refund` 200): `{ id, studentName, createdAt, lines: [{ courseId, title, instructor, price, bundleDiscount, couponDiscount, final }], couponCode, subtotal, bundleDiscount, couponDiscount, total, status }`. `status` is `"Paid"` or `"Refunded"`. `couponCode` is null when no coupon was used.
- **Revenue row** (`GET /api/instructors/revenue`, a list): `{ instructor, grossSales, refunds, instructorShare }`. Every instructor has a row, even with 0 sales.
- **Delete from cart** answers 204 with no body.

## Screens

1. **Course card.** Shows the price, or "Free". A paid course has an "Add to cart" button.
2. **Course page.** Shows the price. A paid course offers "Add to cart" instead of "Enroll".
3. **Cart page.** Lists the lines. Has a coupon box. Shows the price breakdown as you type. Has a Pay button.
4. **My Orders page.** Lists orders. Each Paid order has a Refund button. If the refund is refused, the reason shows under the order.
5. **Instructor Revenue page.** A table of the revenue rows.
6. **Top bar.** New links: Cart, My Orders, Revenue.

## Done means

1. All 20 rules work. Each one has a test.
2. `dotnet build` has no errors. `dotnet test` passes, old tests and new tests.
3. `npm run build` has no errors.
4. With the API running, `bash scripts/e2e-shop.sh` prints PASS for every step.
5. A student can do the whole trip in the browser: add three courses, use a coupon, pay, see the order, refund it.
6. The start data matches the tables above.
