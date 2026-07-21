/* Static "It's a Match" phone mockup — the exact production artwork, no carousel. */
const EXACT_IMG = import.meta.env.BASE_URL + 'hero-phone.png';

export function PhoneMockup() {
  return (
    <div className="phone-carousel">
      <div className="pc-phone pc-photo" role="img" aria-label="It's a Match — Alex Martinez and Sarah Thompson have mutually matched on JobsMatchNow">
        <img className="pc-exact-img" src={EXACT_IMG} alt="It's a Match — Alex Martinez and Sarah Thompson have mutually matched on JobsMatchNow" />
      </div>
    </div>
  );
}
