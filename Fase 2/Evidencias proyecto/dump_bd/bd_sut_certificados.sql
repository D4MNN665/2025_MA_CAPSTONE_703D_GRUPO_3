-- MySQL dump 10.13  Distrib 8.0.42, for Win64 (x86_64)
--
-- Host: localhost    Database: bd_sut
-- ------------------------------------------------------
-- Server version	8.0.42

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `certificados`
--

DROP TABLE IF EXISTS `certificados`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `certificados` (
  `id_certificado` int NOT NULL AUTO_INCREMENT,
  `fecha_solicitud` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `estado` enum('pendiente','aprobado','rechazado') NOT NULL DEFAULT 'pendiente',
  `fecha_resolucion` datetime DEFAULT NULL,
  `motivo` varchar(150) DEFAULT NULL,
  `nacionalidad` varchar(45) DEFAULT NULL,
  `rut` varchar(45) DEFAULT NULL,
  `nombreVecino` varchar(45) DEFAULT NULL,
  `domicilio` varchar(100) DEFAULT NULL,
  `tipo_residencia` varchar(45) DEFAULT NULL,
  `id_vecino` int NOT NULL,
  `razon_rechazo` varchar(150) DEFAULT NULL,
  PRIMARY KEY (`id_certificado`),
  KEY `fk_certificado_vecino` (`id_vecino`),
  CONSTRAINT `fk_certificado_vecino` FOREIGN KEY (`id_vecino`) REFERENCES `vecinos` (`id_vecino`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `certificados`
--

LOCK TABLES `certificados` WRITE;
/*!40000 ALTER TABLE `certificados` DISABLE KEYS */;
INSERT INTO `certificados` VALUES (14,'2025-09-29 21:16:11','aprobado',NULL,'Necesito el certificado porque....','Chileno','20.820.262-6','David Correa','Hnos Campos 261 V Arrayan 1','propietario',18,NULL),(17,'2025-10-03 16:21:44','aprobado',NULL,'Motivo X','Chileno','20.722.122-8','David Correa Mardones','Av san martin 1058','propietario',17,NULL),(18,'2025-10-06 11:28:38','rechazado',NULL,'123','Chileno','20.820.262-6','David Correa Mardones','Av san martin 1058','propietario',18,NULL),(19,'2025-10-06 22:04:30','rechazado',NULL,'13232123132','Chileno','20.820.262-6','David Correa Mardones','Av san martin 1058','propietario',18,'fuiste rechazado porque bla bla bla bla');
/*!40000 ALTER TABLE `certificados` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-10-08  1:37:54
