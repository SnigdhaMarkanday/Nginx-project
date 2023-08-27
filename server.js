const express = require('express');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { PDFDocument } = require('pdf-lib');
const { StandardFonts } = require('pdf-lib');

const app = express();
const port = 3000;

const db = new sqlite3.Database('./database.sqlite');

// Set up SQLite database
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS user_info (
        id INTEGER PRIMARY KEY,
        name TEXT,
        phone TEXT,
        email TEXT,
        document_type TEXT,
        passport_path TEXT,
        other_document_path TEXT
    )`);
});
const pdfFilter = (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
        cb(null, true);
    } else {
        cb(new Error('Only PDFs are allowed'), false);
    }
};


// Set up Multer storage configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// Middleware to serve static files
app.use(express.static('views'));
app.use('/uploads', express.static('uploads'));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});
// ... [Your previous code]

// Serve the list.html page
app.get('/list', (req, res) => {
    res.sendFile(path.join(__dirname, 'list.html'));
});

// Fetch data from SQLite and send it to the frontend
app.get('/get-uploads', (req, res) => {
    db.all(`SELECT * FROM user_info`, [], (err, rows) => {
        if (err) {
            throw err;
        }
        res.json(rows); // Send data as JSON to the frontend
    });
});

// ... [Your previous code]


// app.post('/upload', upload.fields([{ name: 'documentFile', maxCount: 1 }, { name: 'passportFile', maxCount: 1 }]), (req, res) => {
//     const { name, phone, email, documentType } = req.body;

//     const documentFilePath = req.files.documentFile ? req.files.documentFile[0].path : null;
//     const passportFilePath = req.files.passportFile ? req.files.passportFile[0].path : null;

//     db.run(`INSERT INTO user_info (name, phone, email, document_type, passport_path, other_document_path) VALUES (?, ?, ?, ?, ?, ?)`,
//            [name, phone, email, documentType, passportFilePath, documentFilePath], (err) => {
//         if (err) {
//             console.error(err);
//             return res.status(500).send("Error while saving to database.");
//         }
//         res.redirect('/'); // Redirect to homepage after a successful upload
//     });
// });
// app.post('/upload', upload.fields([{ name: 'documentFile', maxCount: 1 }, { name: 'passportFile', maxCount: 1 }]), async (req, res) => {
//     const { name, phone, email, documentType } = req.body;

//     // Combine PDFs and add user information
//     const pdfDoc = await PDFDocument.create();
//     const font = pdfDoc.Font.Helvetica;


//     const page = pdfDoc.addPage([600, 400]);
//     page.drawText(`Name: ${name}`, { x: 50, y: 370, size: 20, font });
//     page.drawText(`Phone: ${phone}`, { x: 50, y: 340, size: 20, font });
//     page.drawText(`Email: ${email}`, { x: 50, y: 310, size: 20, font });
//     page.drawText(`Document Type: ${documentType}`, { x: 50, y: 280, size: 20, font });

//     const documentFilePath = req.files.documentFile ? req.files.documentFile[0].path : null;
//     const passportFilePath = req.files.passportFile ? req.files.passportFile[0].path : null;

//     if (documentFilePath) {
//         const documentPdfBytes = fs.readFileSync(documentFilePath);
//         const documentPdf = await PDFDocument.load(documentPdfBytes);
//         const documentPages = await pdfDoc.copyPages(documentPdf, documentPdf.getPageIndices());
//         documentPages.forEach(page => pdfDoc.addPage(page));
//     }

//     if (passportFilePath) {
//         const passportPdfBytes = fs.readFileSync(passportFilePath);
//         const passportPdf = await PDFDocument.load(passportPdfBytes);
//         const passportPages = await pdfDoc.copyPages(passportPdf, passportPdf.getPageIndices());
//         passportPages.forEach(page => pdfDoc.addPage(page));
//     }

//     const combinedPdfPath = `uploads/combined-${Date.now()}.pdf`;
//     const combinedPdfBytes = await pdfDoc.save();
//     fs.writeFileSync(combinedPdfPath, combinedPdfBytes);

//     // Insert the details into the database
//     db.run(`INSERT INTO user_info (name, phone, email, document_type, passport_path, other_document_path) VALUES (?, ?, ?, ?, ?, ?)`,
//            [name, phone, email, documentType, passportFilePath, combinedPdfPath], (err) => {
//         if (err) {
//             console.error(err);
//             return res.status(500).send("Error while saving to database.");
//         }
//         res.redirect('/'); // Redirect to homepage after a successful upload
//     });
// });
app.post('/upload', upload.fields([{ name: 'documentFile', maxCount: 1 }, { name: 'passportFile', maxCount: 1 }]), async (req, res) => {
    const { name, phone, email, documentType, imageData } = req.body;

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const page = pdfDoc.addPage([600, 400]);
    page.drawText(`Name: ${name}`, { x: 50, y: 370, size: 20, font });
    page.drawText(`Phone: ${phone}`, { x: 50, y: 340, size: 20, font });
    page.drawText(`Email: ${email}`, { x: 50, y: 310, size: 20, font });
    page.drawText(`Document Type: ${documentType}`, { x: 50, y: 280, size: 20, font });

    // Adding snapshot of the form as a new page to the PDF
    if (imageData) {
        const imageBytes = Buffer.from(imageData.split(',')[1], 'base64');
        const image = await pdfDoc.embedPng(imageBytes);
        const snapshotPage = pdfDoc.addPage([600, 800]);  // Adjust dimensions as needed
        snapshotPage.drawImage(image, { x: 0, y: 0, width: 600, height: 800 });
    }

    const documentFilePath = req.files.documentFile ? req.files.documentFile[0].path : null;
    const passportFilePath = req.files.passportFile ? req.files.passportFile[0].path : null;

    if (documentFilePath) {
        const documentPdf = await loadPDF(documentFilePath);
        const documentPages = await pdfDoc.copyPages(documentPdf, documentPdf.getPageIndices());
        documentPages.forEach(page => pdfDoc.addPage(page));
    }

    if (passportFilePath) {
        const passportPdf = await loadPDF(passportFilePath);
        const passportPages = await pdfDoc.copyPages(passportPdf, passportPdf.getPageIndices());
        passportPages.forEach(page => pdfDoc.addPage(page));
    }

    const combinedPdfPath = `uploads/${name}_${phone}.pdf`;   // Name based on user's name and phone number
    const combinedPdfBytes = await pdfDoc.save();
    fs.writeFileSync(combinedPdfPath, combinedPdfBytes);

    // Insert the details into the database
    db.run(`INSERT INTO user_info (name, phone, email, document_type, passport_path, other_document_path) VALUES (?, ?, ?, ?, ?, ?)`,
           [name, phone, email, documentType, passportFilePath, combinedPdfPath], (err) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Error while saving to database.");
        }
        res.redirect('/'); // Redirect to homepage after a successful upload
    });
});


// Starting the server
app.listen(port, () => {
    console.log(`Server started on http://localhost:${port}`);
});
async function loadPDF(filePath) {
    const fileBytes = fs.readFileSync(filePath);
    return await PDFDocument.load(fileBytes);
}

