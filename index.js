require('dotenv').config(); // Carrega variáveis de ambiente do arquivo .env
const express = require('express');
const { Pool } = require('pg'); // Importa o Pool do pacote pg

const app = express();
const port = process.env.PORT || 3000;

// Configuração da conexão com o banco de dados PostgreSQL
// O Pool vai pegar a URL de conexão da variável de ambiente DATABASE_URL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Rota para buscar o cliente
app.get('/cliente', async (req, res) => {
    const { cpf } = req.query;
    console.log('Recebi uma busca pelo CPF:', cpf);

    if (!cpf) {
        return res.status(400).json({ erro: "O parâmetro CPF é obrigatório" });
    }

    try {
        const sql = 'SELECT * FROM clientes WHERE cpf = $1';
        const { rows } = await pool.query(sql, [cpf]);

        if (rows.length > 0) {
            const clienteInfo = {
                ...rows[0],
                fatura_aberta: rows[0].fatura_aberta === 1
            };
            return res.status(200).json(clienteInfo);
        } else {
            return res.status(404).json({ erro: "Cliente não encontrado" });
        }
    } catch (err) {
        console.error("Erro na consulta:", err.message);
        return res.status(500).json({ erro: "Erro interno do servidor." });
    }
});

app.listen(port, () => {
    console.log(`🚀 Servidor da API rodando em http://localhost:${port}`);
});