import { Router } from "express";
import { AuthRoutes } from "../modules/auth/auth.route";
import { UserRoutes } from "../modules/user/user.route";
import { FriendRoutes } from "../modules/friend/friend.route";
import { PostRoutes } from "../modules/post/post.route";
import { PageRoutes } from "../modules/page/page.route";
import { ChatRoutes } from "../modules/chat/chat.route";
import { NotificationRoutes } from "../modules/notification/notification.route";
import { WalletRoutes } from "../modules/wallet/wallet.route";
import { VerificationRoutes } from "../modules/wallet/verification.route";
import { AdRoutes } from "../modules/ad/ad.route";
import { StoryRoutes } from "../modules/story/story.route";
import { GroupRoutes } from "../modules/group/group.route";
import { CommerceRoutes } from "../modules/commerce/commerce.route";
import { ModerationRoutes } from "../modules/moderation/moderation.route";
import { PollRoutes } from "../modules/poll/poll.route";

const router = Router();

const moduleRoutes = [
  {
    path: "/auth",
    route: AuthRoutes,
  },
  {
    path: "/users",
    route: UserRoutes,
  },
  {
    path: "/friends",
    route: FriendRoutes,
  },
  {
    path: "/posts",
    route: PostRoutes,
  },
  {
    path: "/pages",
    route: PageRoutes,
  },
  {
    path: "/chats",
    route: ChatRoutes,
  },
  {
    path: "/notifications",
    route: NotificationRoutes,
  },
  {
    path: "/wallet",
    route: WalletRoutes,
  },
  {
    path: "/verification",
    route: VerificationRoutes,
  },
  {
    path: "/ads",
    route: AdRoutes,
  },
  {
    path: "/stories",
    route: StoryRoutes,
  },
  {
    path: "/groups",
    route: GroupRoutes,
  },
  {
    path: "/marketplace",
    route: CommerceRoutes,
  },
  {
    path: "/admin",
    route: ModerationRoutes,
  },
  {
    path: "/polls",
    route: PollRoutes,
  },
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
