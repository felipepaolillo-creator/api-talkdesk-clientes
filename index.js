// Bloco 1: Importando os pacotes
const express = require('express');
const sqlite3 = require('sqlite3').verbose(); // Importamos o sqlite3

// Bloco 2: Inicializando o Express e conectando ao banco de dados
const app = express();
const port = process.env.PORT || 3000;
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
        console.error("Erro ao abrir o banco de dados:", err.message);
    } else {
        console.log("Conectado ao banco de dados SQLite com sucesso.");
    }
});

// Bloco 3: Criando a nossa rota (agora assíncrona!)
app.get('/cliente', (req, res) => {
    const { cpf } = req.query;
    console.log('Recebi uma busca pelo CPF:', cpf);

    if (!cpf) {
        return res.status(400).json({ erro: "O parâmetro CPF é obrigatório" });
    }

    // A consulta SQL que queremos executar
    const sql = `SELECT * FROM clientes WHERE cpf = ?`;

    // Executando a consulta no banco de dados
    db.get(sql, [cpf], (err, linha) => {
        if (err) {
            // Se der um erro no banco, retornamos um erro 500
            console.error("Erro na consulta:", err.message);
            return res.status(500).json({ erro: "Erro interno do servidor." });
        }

        // Verificando se a consulta retornou uma linha (cliente)
        if (linha) {
            // A coluna 'fatura_aberta' vem como 1 ou 0. Vamos converter para true/false.
            const clienteInfo = {
                ...linha,
                fatura_aberta: linha.fatura_aberta === 1
            };
            return res.status(200).json(clienteInfo);
        } else {
            return res.status(404).json({ erro: "Cliente não encontrado" });
        }
    });
});

// Bloco 4: "Ligando" o servidor
app.listen(port, () => {
    console.log(`🚀 Servidor da API rodando em http://localhost:${port}`);
});