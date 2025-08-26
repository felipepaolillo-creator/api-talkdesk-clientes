require('dotenv').config(); // Carrega variáveis de ambiente do arquivo .env
const express = require('express');
const { Pool } = require('pg'); // Importa o Pool do pacote pg
const { differenceInHours } = require('date-fns');
const { formatInTimeZone } = require('date-fns-tz');

const app = express();
app.use(express.json());
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
// NOVA ROTA POST PARA REGISTRAR UMA CHAMADA
app.post('/registrar-chamada', async (req, res) => {
    // 1. Pega os dados que foram enviados no corpo da requisição
    const { protocolo, id_chamada } = req.body;

    console.log('Recebido para registro:', { protocolo, id_chamada });

    // 2. Validação simples para ver se os dados necessários vieram
    if (!protocolo || !id_chamada) {
        return res.status(400).json({ erro: "Protocolo e id_chamada são obrigatórios." });
    }

    try {
        // 3. Comando SQL para inserir os dados na nova tabela
        const sql = 'INSERT INTO registros_chamadas (protocolo, id_chamada) VALUES ($1, $2) RETURNING *';

        // 4. Executa o comando no banco de dados
        const { rows } = await pool.query(sql, [protocolo, id_chamada]);

        // 5. Retorna uma resposta de sucesso com os dados que foram salvos
        console.log('Chamada registrada com sucesso:', rows[0]);
        return res.status(201).json(rows[0]);

    } catch (err) {
        console.error("Erro ao registrar chamada:", err.message);
        return res.status(500).json({ erro: "Erro interno do servidor." });
    }
});
// NOVA ROTA GET PARA CONSULTAR UM PROTOCOLO DETALHADO
app.get('/consultar-protocolo/:protocolo', async (req, res) => {
    // 1. Pega o número do protocolo que vem na URL
    const { protocolo } = req.params;

    console.log('Recebida consulta para o protocolo:', protocolo);

    try {
        // 2. Comando SQL para buscar os dados na nova tabela
        const sql = 'SELECT * FROM protocolos_detalhados WHERE protocolo = $1';

        // 3. Executa a consulta
        const { rows } = await pool.query(sql, [protocolo]);

        // 4. Verifica se encontrou o protocolo
        if (rows.length > 0) {
            const protocoloDoBanco = rows[0];

            // --- Lógica para calcular se está no prazo ---
            // Vamos definir um prazo de 48 horas como exemplo
            const prazoEmHoras = 48;
            const agora = new Date(); // Pega a data e hora atuais
            const dataCriacao = new Date(protocoloDoBanco.data_criacao); // Converte a data do banco
            const horasDesdeCriacao = differenceInHours(agora, dataCriacao);
            const esta_no_prazo = horasDesdeCriacao <= prazoEmHoras;

            // 5. Prepara a resposta final para o usuário
            const resposta = {
                protocolo: protocoloDoBanco.protocolo,
                // Formata a data para o padrão Brasil e mostra o fuso horário
                data_criacao: formatInTimeZone(dataCriacao, 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm:ss zzz'),
                esta_no_prazo: esta_no_prazo, // O resultado do nosso cálculo
                numero_telefone: protocoloDoBanco.numero_telefone,
                campo_custom_1: protocoloDoBanco.campo_custom_1,
                campo_custom_2: protocoloDoBanco.campo_custom_2,
                campo_custom_3: protocoloDoBanco.campo_custom_3,
                campo_custom_4: protocoloDoBanco.campo_custom_4,
            };

            return res.status(200).json(resposta);

        } else {
            // Se não encontrou, retorna um erro 404
            return res.status(404).json({ erro: "Protocolo não encontrado." });
        }

    } catch (err) {
        console.error("Erro ao consultar protocolo:", err.message);
        return res.status(500).json({ erro: "Erro interno do servidor." });
    }
   

});


// NOVA ROTA GET PARA BUSCAR O ÚLTIMO PROTOCOLO ATIVO POR TELEFONE
app.get('/consultar-por-telefone', async (req, res) => {
    // 1. Pega o número do telefone que vem na URL como query parameter
    const { telefone } = req.query;

    console.log('Recebida consulta para o telefone:', telefone);

    // Validação simples
    if (!telefone) {
        return res.status(400).json({ erro: "O parâmetro 'telefone' é obrigatório." });
    }

    try {
        // 2. A nossa consulta SQL inteligente
        const prazoEmHoras = 48; // Defina o prazo aqui para fácil manutenção
        const sql = `
            SELECT * FROM protocolos_detalhados
            WHERE numero_telefone = $1
            AND data_criacao >= now() - INTERVAL '${prazoEmHoras} hours'
            ORDER BY data_criacao DESC
            LIMIT 1;
        `;

        // 3. Executa a consulta
        const { rows } = await pool.query(sql, [telefone]);

        // 4. Verifica se a consulta retornou algum resultado
        if (rows.length > 0) {
            // Se encontrou, retorna o protocolo encontrado
            const protocoloEncontrado = rows[0];
            return res.status(200).json(protocoloEncontrado);
        } else {
            // Se a consulta não retornou nada, significa que não há protocolos ativos
            return res.status(404).json({ mensagem: "Nenhum protocolo ativo encontrado para este telefone." });
        }

    } catch (err) {
        console.error("Erro ao consultar por telefone:", err.message);
        return res.status(500).json({ erro: "Erro interno do servidor." });
    }
});


app.listen(port, () => {
    console.log(`🚀 Servidor da API rodando em http://localhost:${port}`);
});