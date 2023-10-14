/* eslint-disable */
import { showAlert } from './alerts';

const stripe = Stripe(
  'pk_test_51O0ErwLaaxuYLkeOYCYW1Ad7tcmEfOJwLmt3JpQOUPGn5bbw4q9nblbZ0XhD6a0crrsV8361XTq4qlJ2GOlNiVQi00YSKm0Kru',
);

export const bookTour = async (tourId) => {
  try {
    // 1) Get checkout session from the server
    const session = await axios(
      `http://127.0.0.1:3000/api/v1/bookings/checkout-session/${tourId}`,
    );
    console.log(session.data.session.id);

    // 2) Create checkout form + charge credit card
    await stripe.redirectToCheckout({
      sessionId: session.data.session.id,
    });
  } catch (err) {
    console.log(err);
    showAlert('error', err);
  }
};
