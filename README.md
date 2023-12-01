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

-   In the directory of the API source code you downloaded, you should find a `.env-example` file. Copy the contents of this file to an `.env` file and change the necessary settings: `DATABASE_URL` according to your database (your Postgres `username`, `password` and the `name of the database` that will be used) and `JWT_SECRET` with your generated key ([you can use OpenSSL rand command to do this](https://www.openssl.org/docs/man1.1.1/man1/rand.html)). Other information does not need to be changed.

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

### 4. Generate Prisma code and run database migrations:

-   Generate Prisma code based on your database configuration in the `.env` file. In your terminal, execute the following command:

```
	# This will create Prisma models and the necessary database configuration.
	npx prisma generate
```

-   After executing this command, it is expected that a message similar to `✔ Generated Prisma Client` will be shown.

-   To synchronize the database with the models defined in the Prisma schema, run the following command:

```
	# This will create the necessary tables in the database.
	npx prisma db push
```

-   After executing this command, it is expected that a message similar to the one shown will be displayed:

```
    Environment variables loaded from .env
    Prisma schema loaded from prisma/schema.prisma
    Datasource "db": PostgreSQL database "database_name", schema "public" at "localhost:5432"

    🚀  Your database is now in sync with your Prisma schema.
```

### 5. Start the API:

-   Start the API running with nodemon, using the following command:

```
    # This will start the API.
    npm start
```

-   Your API should now be up and running, accessible locally, if the message `Server running on port 3000` was displayed.

### 6. API endpoints:

-   The API endpoints are documented using Swagger. To access the documentation, start the API and access the following URL in your browser: http://localhost:3000/api-docs/.

### 7. Running tests:

-   The database can be seeded with test data by running the following command:

```
    # This will seed the database with test data.
    npx prisma db seed
```

-   You can also run pre-configured tests by running the following command:

```
    # This will run the defined unit and integration tests.
    npm t
```
