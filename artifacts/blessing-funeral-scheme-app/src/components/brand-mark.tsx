export function BrandMark() {
  const baseUrl = import.meta.env.BASE_URL;

  return (
    <img
      className="brand-mark"
      src={`${baseUrl}blessing-mark.png`}
      alt=""
      aria-hidden="true"
    />
  );
}