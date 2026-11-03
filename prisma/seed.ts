import "dotenv/config";
import { hash } from "argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../src/generated/prisma/client.js";

// Ce seed est destiné aux bases de développement / démonstration uniquement.
if (process.env.NODE_ENV === "production") {
  throw new Error("Le seed de démonstration est interdit en production.");
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL est obligatoire pour le seed.");
}

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

type SeedRole = "USER" | "AGENT" | "ADMIN";

type SeedAnnonce = {
  titre: string;
  description: string;
  type: "VENTE" | "LOCATION";
  typePropriete: "APPARTEMENT" | "MAISON" | "VILLA" | "STUDIO" | "LOFT";
  prix: number;
  ville: string;
  surface: number;
  chambres: number;
  image: string;
  statut?: "PUBLIE" | "BROUILLON";
};

type SeedAccount = {
  name: string;
  email: string;
  password: string;
  role: SeedRole;
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Variable d'environnement manquante : ${name}`);
  return value;
}

function readAccounts(): SeedAccount[] {
  const accounts: SeedAccount[] = [
    {
      name: "Administrateur Horizon",
      email: required("SEED_ADMIN_EMAIL"),
      password: required("SEED_ADMIN_PASSWORD"),
      role: "ADMIN",
    },
    {
      name: "Agent Horizon 1",
      email: required("SEED_AGENT_1_EMAIL"),
      password: required("SEED_AGENT_1_PASSWORD"),
      role: "AGENT",
    },
    {
      name: "Agent Horizon 2",
      email: required("SEED_AGENT_2_EMAIL"),
      password: required("SEED_AGENT_2_PASSWORD"),
      role: "AGENT",
    },
    {
      name: "Utilisateur Horizon 1",
      email: required("SEED_USER_1_EMAIL"),
      password: required("SEED_USER_1_PASSWORD"),
      role: "USER",
    },
    {
      name: "Utilisateur Horizon 2",
      email: required("SEED_USER_2_EMAIL"),
      password: required("SEED_USER_2_PASSWORD"),
      role: "USER",
    },
  ];
  const emails = accounts.map((account) => account.email.toLowerCase());
  if (new Set(emails).size !== emails.length) {
    throw new Error("Les 5 emails de démonstration doivent être distincts.");
  }
  for (const account of accounts) {
    if (account.password.length < 12) {
      throw new Error(`Le mot de passe de démonstration pour ${account.email} doit comporter au moins 12 caractères.`);
    }
  }
  return accounts;
}

async function ensureAccount(account: SeedAccount) {
  const existing = await prisma.user.findUnique({ where: { email: account.email } });

  // Ne pas promouvoir un compte existant vers AGENT ou ADMIN.
  if (existing && existing.role !== account.role) {
    throw new Error(`Rôle incompatible pour ${account.email} : ${existing.role} au lieu de ${account.role}`);
  }

  const passwordHash = await hash(account.password);
  return prisma.user.upsert({
    where: { email: account.email },
    create: {
      name: account.name,
      email: account.email,
      passwordHash,
      role: account.role,
    },
    update: {
      name: account.name,
      passwordHash,
    },
  });
}

// Douze annonces du TP1 conservées ; photos converties en URLs HTTP.

const annonces: SeedAnnonce[] = [
  {
    titre: "Appartement haussmannien avec balcon",
    description:
      "Appartement haussmannien lumineux avec balcon, beaux volumes et prestations de caractère au cœur de Paris.",
    type: "VENTE",
    typePropriete: "APPARTEMENT",
    prix: 895000,
    ville: "Paris",
    surface: 96,
    chambres: 3,
    image: "https://picsum.photos/seed/immoservice-01/640/480",
  },
  {
    titre: "Loft lumineux rénové, quartier Confluence",
    description:
      "Loft entièrement rénové dans le quartier Confluence à Lyon, avec grands volumes, lumière naturelle et espaces ouverts.",
    type: "LOCATION",
    typePropriete: "LOFT",
    prix: 1850,
    ville: "Lyon",
    surface: 112,
    chambres: 3,
    image: "https://picsum.photos/seed/immoservice-02/640/480",
  },
  {
    titre: "Maison en pierre avec jardin arboré",
    description:
      "Belle maison en pierre avec jardin arboré à Bordeaux, idéale pour une famille recherchant calme et authenticité.",
    type: "VENTE",
    typePropriete: "MAISON",
    prix: 620000,
    ville: "Bordeaux",
    surface: 145,
    chambres: 4,
    image: "https://picsum.photos/seed/immoservice-03/640/480",
  },
  {
    titre: "Studio moderne au cœur du Vieux-Port",
    description:
      "Studio moderne et lumineux situé à proximité immédiate du Vieux-Port de Marseille, entièrement aménagé et prêt à vivre.",
    type: "LOCATION",
    typePropriete: "STUDIO",
    prix: 850,
    ville: "Marseille",
    surface: 34,
    chambres: 1,
    image: "https://picsum.photos/seed/immoservice-04/640/480",
  },
  {
    titre: "Appartement vue mer, Promenade des Anglais",
    description:
      "Appartement élégant offrant une superbe vue mer sur la Promenade des Anglais, avec grande pièce de vie lumineuse.",
    type: "VENTE",
    typePropriete: "APPARTEMENT",
    prix: 760000,
    ville: "Nice",
    surface: 88,
    chambres: 3,
    image: "https://picsum.photos/seed/immoservice-05/640/480",
  },
  {
    titre: "Maison familiale proche du centre",
    description:
      "Maison familiale spacieuse située à proximité du centre de Nantes, avec jardin et espaces de vie adaptés à une famille.",
    type: "VENTE",
    typePropriete: "MAISON",
    prix: 415000,
    ville: "Nantes",
    surface: 128,
    chambres: 4,
    image: "https://picsum.photos/seed/immoservice-06/640/480",
  },
  {
    titre: "T3 avec terrasse, quartier Carmes",
    description:
      "Appartement T3 avec terrasse dans le quartier des Carmes à Toulouse, bénéficiant d'une belle luminosité et d'un extérieur agréable.",
    type: "LOCATION",
    typePropriete: "APPARTEMENT",
    prix: 1250,
    ville: "Toulouse",
    surface: 74,
    chambres: 2,
    image: "https://picsum.photos/seed/immoservice-07/640/480",
  },
  {
    titre: "Chalet contemporain vue lac",
    description:
      "Chalet contemporain avec vue exceptionnelle sur le lac d'Annecy, grands espaces vitrés et prestations haut de gamme.",
    type: "LOCATION",
    typePropriete: "MAISON",
    prix: 3200,
    ville: "Annecy",
    surface: 160,
    chambres: 5,
    image: "https://picsum.photos/seed/immoservice-08/640/480",
  },
  {
    titre: "Appartement rénové, Vieux-Lille",
    description:
      "Appartement entièrement rénové dans le Vieux-Lille, combinant le charme de l'ancien et des prestations contemporaines.",
    type: "VENTE",
    typePropriete: "APPARTEMENT",
    prix: 365000,
    ville: "Lille",
    surface: 68,
    chambres: 2,
    image: "https://picsum.photos/seed/immoservice-09/640/480",
  },
  {
    titre: "Villa avec piscine face à l'océan",
    description:
      "Villa d'exception avec piscine et vue sur l'océan à Biarritz, entourée d'un jardin paysager et de grandes terrasses.",
    type: "VENTE",
    typePropriete: "VILLA",
    prix: 1450000,
    ville: "Biarritz",
    surface: 210,
    chambres: 5,
    image: "https://picsum.photos/seed/immoservice-10/640/480",
  },
  {
    titre: "Duplex atypique, bords de Saône",
    description:
      "Duplex atypique situé sur les bords de Saône à Lyon, avec mezzanine, grands volumes et belle luminosité.",
    type: "LOCATION",
    typePropriete: "APPARTEMENT",
    prix: 1650,
    ville: "Lyon",
    surface: 92,
    chambres: 3,
    image: "https://picsum.photos/seed/immoservice-11/640/480",
  },
  {
    titre: "Appartement de standing, Golden Triangle",
    description:
      "Appartement de standing situé dans le Triangle d'Or parisien, avec beaux volumes, finitions haut de gamme et prestations raffinées.",
    type: "VENTE",
    typePropriete: "APPARTEMENT",
    prix: 1250000,
    ville: "Paris",
    surface: 134,
    chambres: 4,
    image: "https://picsum.photos/seed/immoservice-12/640/480",
  },
  {
    titre: "Appartement T2 en cours de préparation",
    description: "Brouillon de démonstration réservé à l'agent 1.",
    type: "VENTE",
    typePropriete: "APPARTEMENT",
    prix: 178000,
    ville: "Le Havre",
    surface: 48,
    chambres: 1,
    image: "https://picsum.photos/seed/immoservice-13/640/480",
    statut: "BROUILLON",
  },
  {
    titre: "Maison familiale en préparation",
    description: "Brouillon de démonstration réservé à l'agent 2.",
    type: "LOCATION",
    typePropriete: "MAISON",
    prix: 1450,
    ville: "Rouen",
    surface: 98,
    chambres: 3,
    image: "https://picsum.photos/seed/immoservice-14/640/480",
    statut: "BROUILLON",
  },
]


async function main() {
  const accounts = readAccounts();
  const users = await Promise.all(accounts.map(ensureAccount));
  const agent1 = users[1]!;
  const agent2 = users[2]!;

  // Identifiants stables pour éviter les doublons lors des réexécutions.
  for (const [index, bien] of annonces.entries()) {
    const id = `demo-immo-annonce-${String(index + 1).padStart(2, "0")}`;
    const auteurId = index < 12
      ? (index % 2 === 0 ? agent1.id : agent2.id)
      : (index === 12 ? agent1.id : agent2.id);

    const data = {
      auteurId,
      titre: bien.titre,
      description: bien.description,
      type: bien.type,
      typePropriete: bien.typePropriete,
      statut: bien.statut ?? ("PUBLIE" as const),
      etat: "DISPONIBLE" as const,
      prix: new Prisma.Decimal(String(bien.prix)),
      dateDisponibilite: new Date(),
      ville: bien.ville,
      surface: bien.surface,
      chambres: bien.chambres,
    };
    const photo = { url: bien.image, alt: `Photo du bien : ${bien.titre}` };

    await prisma.annonce.upsert({
      where: { id },
      create: {
        id,
        ...data,
        photos: { create: photo },
      },
      update: {
        ...data,
        photos: {
          deleteMany: {},
          create: photo,
        },
      },
    });
  }

  console.log("Seed : 5 comptes (2 agents, 2 USER, 1 ADMIN)");
  console.log("Seed : 14 annonces (12 publiées, 2 brouillons)");
}

main()
  .catch((error: unknown) => {
    console.error("Échec du seed :", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
