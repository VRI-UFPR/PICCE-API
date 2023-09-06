# PICCE

### Introduction

In elementary schools in Brazil, the study method is often monotonous since there is no means to learn in a fun and more interactive way, distancing the relationship between student and teacher. This bland study method makes learning difficult since if the practice of teaching isn't fun, it's harder for students to focus, and they tend to get less knowledge. As the main objective of the Science at School project, we have the dissemination of science within elementary schools, thus bringing a diversified project of teacher evaluation methods, in which we will create forms of evaluation from the simplest to the most complex. According to the 2021 FGV survey1, Brazil has 440 million digital devices in use (computers, notebooks, tablets, and smartphones), approximately two devices per inhabitant. Knowing this, the group aims to create a project including a smartphone app for interacting and answering protocols and a dashboard for the teacher, or pedagogical supervisor (who will have a higher position within the platform) to create, remove and edit protocols. These protocols may include practical activities, such as taking photos and recording videos, or several academic activities, such as writing a text or an objective multiple-choice question.

### Forms

Forms are chained sequences of statements and answers. These forms are going to be used by students to execute a protocol. A teacher and researcher have access to and permission to create, edit and delete the form components.

The forms contain one kind of components indicating for the user what to do, how to do it, and what must be delivered. Prologue and epilogue are mandatory components of this kind. The forms have also another kind of components for students to fill in and respond to what was requested.

## PICCE-API server setup and running

### 1. Install the necessary tools:

-   Ensure you have PostgreSQL, Node.js and npm (Node.js package manager) installed on your machine. You can check the installation by running the following commands in your terminal:

```
	psql --version
	node -v
	npm -v
```

-   If these commands return versions, the requirements are installed. The DBMS can be changed, but it will require some additional configuration since the API is pre-configured to use Postgres.

### 2. Configure environment variables:

-   In the directory of the API source code you downloaded, you should find a `.env-example` file. Copy the contents of this file to an `.env` file and change the necessary settings according to your database (your Postgres `username`, `password` and the `name of the database` that will be used). Other information does not need to be changed.

```
	# Create a copy of .env-example as .env
	cp .env-example .env

	# Open .env file in a text editor to edit configurations
	nano .env
```

### 3. Install dependencies:

-   In the directory of the API source code, open a terminal and run the following command to install project dependencies listed in the `package.json` file:

```
	npm install
```

### 4. Compile the TypeScript project:

-   In the same directory, compile your TypeScript code into JavaScript using the TypeScript compiler (`tsc`). Run the following command:

```
	# This will create a "dist" folder with compiled JavaScript files.
	npx tsc
```

-   After running this command, a `dist` folder should have been created in the root directory of the project.

### 5. Generate Prisma code and run database migrations:

-   Generate Prisma code based on your database configuration in the `.env` file. In your terminal, execute the following command:

```
	# This will create Prisma models and the necessary database configuration.
	npx prisma generate
```

-   After executing this command, it is expected that a message similar to `✔ Generated Prisma Client` will be shown.

-   To create database tables based on Prisma models, run the following command:

```
	# This will apply any pending migrations.
	npx prisma migrate dev
```

-   After executing this command, it is expected that a message similar to the one shown will be displayed: `Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "vri_picce", schema "public" at "localhost:5432"`.

### 6. Start the API:

-   Start the API running its compiled entry point located in dist/app.js, using the following command:

```
	node dist/app.js
```

-   Your API should now be up and running, accessible locally, if the message `Server running on port 3000` was displayed.
