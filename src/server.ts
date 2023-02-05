import express from 'express';
import fs from 'fs/promises';
import morgan from 'morgan';
import multer from 'multer';
import { BucketCannedACL } from '@aws-sdk/client-s3';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { DeleteObjectRequest, S3Client } from '@aws-sdk/client-s3';
import 'dotenv/config';

const region = process.env.AWS_REGION

const s3 = new S3Client({ region: region, credentials: { accessKeyId: process.env.AWS_ACCESS_KEY || '', secretAccessKey: process.env.AWS_SECRET_KEY || '' } });

const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        try {
            await fs.mkdir('uploads/')
        } catch {
            console.log('file already exists')
        }
        cb(null, 'uploads/')
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        const ext = file.mimetype.split('/')[1]
        cb(null, file.originalname + '-' + uniqueSuffix + '.' + ext)
    }
});
const app = express();
const upload = multer({ storage: storage });


const server = () => {
    app.use(morgan('tiny'))
    app.use(upload.single('media'))

    app.post('/putObject', async (req, res) => {
        const filePath = req.query.filePath
        let path = undefined
        if (typeof filePath === 'string') {
            if (filePath.endsWith('/')) {
                path = filePath
            }
            else {
                path = filePath + '/'
            }
        }

        if (req.file) {
            const file = await fs.readFile(req.file?.path)

            let params = {
                Bucket: "elasticbeanstalk-us-west-2-828838308571",
                Key: `${path ? path : ''}${req.file?.originalname}`,
                Body: file,
                ACL: BucketCannedACL.public_read
            }

            try {
                if (file) {
                    const response = await s3.send(new PutObjectCommand(params))
                }
            } catch (err) {
                console.log(err)
                console.log('Error occurred while creating object')
                return res.status(400).json({ message: 'failure' })
            } finally {
                await fs.rm(req.file?.path)
            }
        }
        res.status(200).json({ message: 'Success' })
    })

    app.get('/getObject', async (req, res) => {
        const filename = req.query.filename

        if (typeof filename !== 'string') {
            return res.status(404).json({ message: 'queryString not found' })
        }

        let params = {
            Bucket: "elasticbeanstalk-us-west-2-828838308571",
            Key: filename,
        }

        let response = null

        try {
            response = await s3.send(new GetObjectCommand(params))

        } catch (err: any) {
            console.log(err)
            let message = 'failure'

            if (err.Code === "NoSuchKey")
                message = 'No such object key found';

            console.log(`Error with code ${err.Code} occurred while retrieving image`)
            return res.status(400).json({ message: message })
        }

        try {
            const file = await response.Body?.transformToByteArray()
            if (file) {
                fs.writeFile(`uploads/${filename}`, file)
            }

        } catch {
            console.log('Error while saving file')
            return res.status(400).json({ message: 'failure' })
        }

        res.status(200).json({ message: 'Success' })
    })

    app.delete('/deleteObject', async (req, res) => {
        const filename = req.query.filename

        if (typeof filename !== 'string') {
            return res.status(404).json({ message: 'query not found' })
        }

        let params: DeleteObjectRequest = {
            Bucket: "elasticbeanstalk-us-west-2-828838308571",
            Key: filename,
        }

        try {
            await s3.send(new DeleteObjectCommand(params))
        } catch (err) {
            console.log(err)
            console.log('Error Occurred while deleting Image')
            return res.status(400).json({ message: 'failure' })
        }

        res.status(200).json({ message: 'success' })
    })

    app.listen(8000, () => {
        console.log("server listening on port 3000");
    })
}
server();