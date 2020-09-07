import fs from "fs";
import http from "http";
import path from "path";
import mime from "mime-types";

const ROOT_PATH = 'C:\\Users\\Personal\\Downloads';

const server = http.createServer((req, res) => { 
    const { url } = req;
    const filePath = path.join(ROOT_PATH, url);
 })