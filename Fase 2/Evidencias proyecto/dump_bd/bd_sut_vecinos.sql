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
-- Table structure for table `vecinos`
--

DROP TABLE IF EXISTS `vecinos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vecinos` (
  `id_vecino` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(45) NOT NULL,
  `apellido` varchar(45) NOT NULL,
  `rut` varchar(45) NOT NULL,
  `correo` varchar(255) NOT NULL,
  `numero_telefono` varchar(45) DEFAULT NULL,
  `direccion` varchar(255) DEFAULT NULL,
  `miembro` tinyint NOT NULL DEFAULT '0',
  `contrasena` varchar(45) DEFAULT NULL,
  `fecha_nacimiento` date DEFAULT NULL,
  PRIMARY KEY (`id_vecino`),
  UNIQUE KEY `rut_UNIQUE` (`rut`)
) ENGINE=InnoDB AUTO_INCREMENT=100 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vecinos`
--

LOCK TABLES `vecinos` WRITE;
/*!40000 ALTER TABLE `vecinos` DISABLE KEYS */;
INSERT INTO `vecinos` VALUES (17,'sebastian','palma','20.722.122-8','sebastian.palma945@gmail.com','+56951995463','Clotario blest 1712',1,'147','2002-01-03'),(18,'David','Correa','20.820.262-6','sebastian.palma945@gmail.com','+56900000000','Hnos Campos 261 V Arrayan 1',1,'123',NULL),(88,'test','mayor_14','23.093.205-0','nuevo_correo@gmail.com','912345678','Calle falsa 123',1,'123','2010-10-27'),(89,'test','mayor_14','10.805.915-K','10.805.915-K@gmail.com','912345678','Calle falsa 123',1,'123','2010-10-27'),(90,'test','mayor_14','10.944.686-6','10.944.686-6@gmail.com','912345678','Calle falsa 123',1,'123','2010-10-27'),(91,'test','mayor_14','11.285.602-1','11.285.602-1@gmail.com','912345678','Calle falsa 123',1,'123','2010-10-27'),(92,'test','mayor_14','16.911.054-9','16.911.054-9@gmail.com','912345678','Calle falsa 123',1,'123','2010-10-27'),(93,'test','mayor_14','21.453.264-6','21.453.264-6@gmail.com','912345678','Calle falsa 123',1,'123','2010-10-27'),(94,'test','mayor_14','18.745.762-9','18.745.762-9@gmail.com','912345678','Calle falsa 123',1,'123','2010-10-27'),(95,'test','mayor_14','17.161.043-5','17.161.043-5@gmail.com','912345678','Calle falsa 123',1,'123','2010-10-27'),(96,'test','mayor_14','19.850.893-4','19.850.893-4@gmail.com','912345678','Calle falsa 123',1,'123','2010-10-27'),(97,'test','mayor_14','20.696.979-2','20.696.979-2@gmail.com','912345678','Calle falsa 123',1,'123','2010-10-27'),(98,'test','mayor_14','15.235.533-5','15.235.533-5@gmail.com','912345678','Calle falsa 123',1,'123','2010-10-27'),(99,'test','mayor_14','15.003.899-5','15.003.899-5@gmail.com','912345678','Calle falsa 123',1,'123','2010-10-27');
/*!40000 ALTER TABLE `vecinos` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-11-06 20:24:15
