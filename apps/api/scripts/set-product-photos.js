const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

/** Legacy SVG catalog art → same JPG photos as the Next.js storefront. */
const svgToJpg = {
  "/assets/img/products/drill-bit.svg": "/assets/img/photos/drill-bit.jpg",
  "/assets/img/products/mud-motor.svg": "/assets/img/photos/mud-motor.jpg",
  "/assets/img/products/gate-valve.svg": "/assets/img/photos/gate-valve.jpg",
  "/assets/img/products/ball-valve.svg": "/assets/img/photos/ball-valve.jpg",
  "/assets/img/products/flange.svg": "/assets/img/photos/flange.jpg",
  "/assets/img/products/fr-coverall.svg": "/assets/img/photos/coverall-fr.jpg",
  "/assets/img/products/h2s-kit.svg": "/assets/img/photos/respirator.jpg",
  "/assets/img/products/pump.svg": "/assets/img/photos/pump.jpg",
  "/assets/img/products/transmitter.svg": "/assets/img/photos/transmitter.jpg",
  "/assets/img/products/chemicals.svg": "/assets/img/photos/chemicals.jpg",
};

const slugPhotos = {
  "mud-motor-6-75": "/assets/img/photos/mud-motor.jpg",
  "mud-motor-4-75": "/assets/img/photos/mud-motor.jpg",
  "pdc-drill-bit-8-5": "/assets/img/photos/drill-bit.jpg",
  "pdc-drill-bit-12-25": "/assets/img/photos/drill-bit.jpg",
  "stabilizer-8-5-spiral": "/assets/img/photos/drill-bit.jpg",
  "centrifugal-pump-4x3": "/assets/img/photos/pump.jpg",
  "triplex-mud-pump-liners": "/assets/img/photos/pump.jpg",
  "drilling-fluid-pack-1t": "/assets/img/photos/chemicals.jpg",
  "barite-api-1t": "/assets/img/photos/chemicals.jpg",
  "corrosion-inhibitor-200l": "/assets/img/photos/chemicals.jpg",
  "h2s-escape-kit": "/assets/img/photos/respirator.jpg",
  "fr-coverall-cat2": "/assets/img/photos/coverall-fr.jpg",
  "fr-coverall-cat3": "/assets/img/photos/coverall-fr.jpg",
  "chemical-gloves-class-b": "/assets/img/photos/gloves.jpg",
  "safety-harness-en361": "/assets/img/photos/harness.jpg",
  "safety-helmet-chin": "/assets/img/photos/hardhat.jpg",
  "gas-detector-4gas": "/assets/img/photos/respirator.jpg",
  "pt-0-100bar": "/assets/img/photos/transmitter.jpg",
  "pt-0-400bar": "/assets/img/photos/transmitter.jpg",
  "flow-coriolis-dn50": "/assets/img/photos/transmitter.jpg",
  "level-radar-80ghz": "/assets/img/photos/transmitter.jpg",
  "wn-flange-8-sch40": "/assets/img/photos/flange.jpg",
  "blind-flange-6-cl600": "/assets/img/photos/flange.jpg",
  "ball-valve-4-fb": "/assets/img/photos/ball-valve.jpg",
  "ball-valve-2-rb": "/assets/img/photos/ball-valve-2.jpg",
  "gate-valve-6-cl600": "/assets/img/photos/gate-valve.jpg",
  "gate-valve-4-cl300": "/assets/img/photos/gate-valve.jpg",
  "check-valve-3-swing": "/assets/img/photos/gate-valve.jpg",
};

async function main() {
  for (const [from, to] of Object.entries(svgToJpg)) {
    const res = await prisma.product.updateMany({
      where: { imageUrl: from },
      data: { imageUrl: to },
    });
    if (res.count) console.log("url", from, "->", to, res.count);
  }
  for (const [slug, imageUrl] of Object.entries(slugPhotos)) {
    const res = await prisma.product.updateMany({
      where: { slug },
      data: { imageUrl },
    });
    if (res.count) console.log("slug", slug, res.count, imageUrl);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
