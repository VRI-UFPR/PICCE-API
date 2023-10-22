import passport from "passport";
import { Strategy, ExtractJwt } from "passport-jwt";
import prismaClient from "./prismaClient";

const options = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET,
};

passport.use(
    new Strategy(options, async (payload, done) => {
        try {
            const user = await prismaClient.user.findUnique({ where: { id: payload.id } });
            if (user) {
                return done(null, user);
            }
            return done(null, false);
        } catch (error) {
            return done(error, false);
        }
    })
);
