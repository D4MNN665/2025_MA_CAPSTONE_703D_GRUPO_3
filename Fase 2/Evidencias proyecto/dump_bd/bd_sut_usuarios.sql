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
-- Table structure for table `usuarios`
--

DROP TABLE IF EXISTS `usuarios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `usuarios` (
  `id_usuario` int NOT NULL AUTO_INCREMENT,
  `id_vecino` int NOT NULL,
  `nombre` varchar(50) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `rol` enum('admin','directivo','secretario','tesorero','vecino') NOT NULL DEFAULT 'directivo',
  `rut` varchar(45) NOT NULL,
  PRIMARY KEY (`id_usuario`),
  KEY `fk_usuario_vecino` (`id_vecino`),
  KEY `fk_usuario_vecino_rut` (`rut`),
  CONSTRAINT `fk_usuario_vecino` FOREIGN KEY (`id_vecino`) REFERENCES `vecinos` (`id_vecino`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_usuario_vecino_rut` FOREIGN KEY (`rut`) REFERENCES `vecinos` (`rut`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=88 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `usuarios`
--

LOCK TABLES `usuarios` WRITE;
/*!40000 ALTER TABLE `usuarios` DISABLE KEYS */;
INSERT INTO `usuarios` VALUES (1,17,'sebastian','147','admin','20.722.122-8'),(6,18,'David','123','directivo','20.820.262-6'),(76,88,'test','123','vecino','23.093.205-0'),(77,89,'test','123','vecino','10.805.915-K'),(78,90,'test','123','vecino','10.944.686-6'),(79,91,'test','123','vecino','11.285.602-1'),(80,92,'test','123','vecino','16.911.054-9'),(81,93,'test','123','vecino','21.453.264-6'),(82,94,'test','123','vecino','18.745.762-9'),(83,95,'test','123','vecino','17.161.043-5'),(84,96,'test','123','vecino','19.850.893-4'),(85,97,'test','123','vecino','20.696.979-2'),(86,98,'test','123','vecino','15.235.533-5'),(87,99,'test','123','vecino','15.003.899-5');
/*!40000 ALTER TABLE `usuarios` ENABLE KEYS */;
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
