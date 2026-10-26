# Kullanım: make up DB=postgres | mysql | mongo | neo4j | mssql
DB ?= postgres

up:     ; docker compose --profile $(DB) up -d
down:   ; docker compose --profile all down
logs:   ; docker compose --profile $(DB) logs -f $(DB)
reset:  ; docker compose --profile all down -v
psql:   ; docker compose exec postgres psql -U $${POSTGRES_USER:-app} $${POSTGRES_DB:-projectdb}
mysql:  ; docker compose exec mysql mysql -u root -p
mongosh:; docker compose exec mongo mongosh -u $${MONGO_USER:-admin} -p $${MONGO_PASSWORD:-admin_dev_pw}
cypher: ; docker compose exec neo4j cypher-shell -u $${NEO4J_USER:-neo4j} -p $${NEO4J_PASSWORD:-neo4j_dev_pw}
.PHONY: up down logs reset psql mysql mongosh cypher
