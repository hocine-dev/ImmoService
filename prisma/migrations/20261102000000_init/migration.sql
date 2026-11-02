-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'AGENT', 'ADMIN');

-- CreateEnum
CREATE TYPE "TypeBien" AS ENUM ('VENTE', 'LOCATION');

-- CreateEnum
CREATE TYPE "StatutPublication" AS ENUM ('BROUILLON', 'PUBLIE');

-- CreateEnum
CREATE TYPE "EtatBien" AS ENUM ('DISPONIBLE', 'LOUE', 'VENDU');

-- CreateEnum
CREATE TYPE "TypePropriete" AS ENUM ('APPARTEMENT', 'MAISON', 'VILLA', 'STUDIO', 'LOFT');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "annonce" (
    "id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "TypeBien" NOT NULL,
    "typePropriete" "TypePropriete" NOT NULL,
    "statut" "StatutPublication" NOT NULL DEFAULT 'BROUILLON',
    "etat" "EtatBien" NOT NULL DEFAULT 'DISPONIBLE',
    "prix" DECIMAL(12,2) NOT NULL,
    "dateDisponibilite" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ville" TEXT NOT NULL,
    "surface" INTEGER NOT NULL,
    "chambres" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "auteurId" TEXT NOT NULL,

    CONSTRAINT "annonce_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photo" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT NOT NULL,
    "annonceId" TEXT NOT NULL,

    CONSTRAINT "photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question" (
    "id" TEXT NOT NULL,
    "texte" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "auteurId" TEXT NOT NULL,
    "annonceId" TEXT NOT NULL,

    CONSTRAINT "question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reponse" (
    "id" TEXT NOT NULL,
    "texte" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "questionId" TEXT NOT NULL,
    "auteurId" TEXT NOT NULL,

    CONSTRAINT "reponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favori" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "annonceId" TEXT NOT NULL,

    CONSTRAINT "favori_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "annonce_statut_createdAt_idx" ON "annonce"("statut", "createdAt");

-- CreateIndex
CREATE INDEX "annonce_auteurId_idx" ON "annonce"("auteurId");

-- CreateIndex
CREATE INDEX "photo_annonceId_idx" ON "photo"("annonceId");

-- CreateIndex
CREATE INDEX "question_annonceId_idx" ON "question"("annonceId");

-- CreateIndex
CREATE INDEX "question_auteurId_idx" ON "question"("auteurId");

-- CreateIndex
CREATE UNIQUE INDEX "reponse_questionId_key" ON "reponse"("questionId");

-- CreateIndex
CREATE INDEX "reponse_auteurId_idx" ON "reponse"("auteurId");

-- CreateIndex
CREATE INDEX "favori_annonceId_idx" ON "favori"("annonceId");

-- CreateIndex
CREATE UNIQUE INDEX "favori_userId_annonceId_key" ON "favori"("userId", "annonceId");

-- AddForeignKey
ALTER TABLE "annonce" ADD CONSTRAINT "annonce_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo" ADD CONSTRAINT "photo_annonceId_fkey" FOREIGN KEY ("annonceId") REFERENCES "annonce"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question" ADD CONSTRAINT "question_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question" ADD CONSTRAINT "question_annonceId_fkey" FOREIGN KEY ("annonceId") REFERENCES "annonce"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reponse" ADD CONSTRAINT "reponse_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reponse" ADD CONSTRAINT "reponse_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favori" ADD CONSTRAINT "favori_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favori" ADD CONSTRAINT "favori_annonceId_fkey" FOREIGN KEY ("annonceId") REFERENCES "annonce"("id") ON DELETE CASCADE ON UPDATE CASCADE;
