const express = require('express');
const dotenv = require('dotenv');
const app = express();
const mysql = require('mysql');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
// Set up Global configuration access
dotenv.config();

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'inventam_category'
});

connection.connect((err) => {
    if (err) throw err;
    console.log('Connected to MySQL database!');
});

// Middleware
app.use(express.json()); // Parse JSON request bodies

// Define the middleware function
const requireAuth = (req, res, next) => {
    let tokenHeaderKey = process.env.TOKEN_HEADER_KEY;
    let jwtSecretKey = process.env.JWT_SECRET_KEY;

    try {
        const token = req.header(tokenHeaderKey);

        const verified = jwt.verify(token, jwtSecretKey);
        console.log(verified);
        if(verified){
            next();
        }else{
            return res.status(401).json({ message: 'Unauthorized' });
        }
    } catch (error) {
        // Access Denied
        return res.status(401).send({ message: 'Unauthorized' });
    }
};

app.post('/signin', (req, res) => {
    const { username, password } = req.body;
    connection.query('SELECT * FROM user WHERE username = ?',[username], (err, results) => {
        if (err) throw err;
        console.log(err);
        if (results.length === 0) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }

        const user = results[0];
        console.log(user.password);

        bcrypt.compare(password, user.password, (err, result) => {
            if (err) throw err;

            if (!result) {
                return res.status(401).json({ message: 'Invalid username or password' });
            }

            // Create a session object for the user
            let jwtSecretKey = process.env.JWT_SECRET_KEY;
            let data = {
                time: Date(),
                userId: user.id,
            }

            const token = jwt.sign(data, jwtSecretKey);

            res.send({ message: 'Sign in successful',token:token,user_id:user.id });
        });
    });
});

app.post('/category', (req, res) => {
    const { category_name } = req.body;
    var sql = "INSERT INTO categories (category_name) VALUES ('"+category_name+"')";
    connection.query(sql, (err, results, fields) => {
        if (err) throw err;
        console.log(err);
        res.send({ success: true, message: 'Category created successfully' });
    });


});

app.post('/subcategory',requireAuth, (req, res) => {
    const { category_name,parent_id } = req.body;
    console.log(req.body);
    var sql = "INSERT INTO categories (category_name,parent_id) VALUES ('"+category_name+"','"+parent_id+"')";
    console.log(sql);
    connection.query(sql, (err, results, fields) => {
        if (err) throw err;
        console.log(err);
        res.send({ success: true, message: 'Sub Category created successfully' });
    });
});

app.put('/category/update/:id',requireAuth, (req, res) => {
    const { id } = req.params;
    const { category_name, parent_id } = req.body;

    connection.query('UPDATE categories SET category_name = ?, parent_id = ? WHERE id = ?', [category_name, parent_id, id], (err, results, fields) => {
        if (err) throw err;

        res.send({ success: true, message: 'Category updated successfully' });
    });
});

app.delete('/category/delete/:id',requireAuth, (req, res) => {
    const { id } = req.params;
    connection.query('DELETE FROM categories WHERE id = ?', [id], (err, results, fields) => {
        if (err) throw err;
        res.send({ success: true, message: 'Category deleted successfully' });
        connection.query('DELETE FROM categories WHERE parent_id = ?', [id], (err, results, fields) => {
            if (err) throw err;
        });
    });

});

app.get('/categoriesList',requireAuth, (req, res) => {
    const page = req.query.page || 1;
    const limit = req.query.limit || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';

    connection.query(`SELECT s1.id,s1.category_name,s2.category_name as subcategory_name FROM categories s1, categories s2 WHERE (s1.id = s2.parent_id) AND (s1.category_name LIKE '%${search}%' OR s2.category_name LIKE '%${search}%') LIMIT ${limit} OFFSET ${offset}`, (err, results, fields) => {
        if (err) throw err;

        connection.query('SELECT COUNT(*) as count FROM categories s1, categories s2 WHERE s2.parent_id = s1.id AND s1.category_name LIKE ? OR s2.category_name = ?', [`%${search}%`,`%${search}%`], (err, countResults, fields) => {
            if (err) throw err;
            const totalCount = countResults[0].count;
            const totalPages = Math.ceil(totalCount / limit);

            res.send({
                success: true,
                data: {
                    list: results,
                    pagination: {
                        page,
                        totalPages,
                        totalCount
                    }
                }
            });
        });
    });
});

const port = process.env.PORT || 5000;
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
