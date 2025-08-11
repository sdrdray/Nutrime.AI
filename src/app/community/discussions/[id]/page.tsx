// src/app/community/discussions/[id]/page.tsx
import { firestore } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import type { SymptomDiscussion, DiscussionPost } from '@/lib/types';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MessageSquare, ThumbsUp, UserCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import ReplyForm from '@/components/community/reply-form';
import { Separator } from '@/components/ui/separator';

async function getDiscussionDetails(id: string): Promise<{ discussion: SymptomDiscussion, posts: DiscussionPost[] } | null> {
    const discussionDocRef = doc(firestore, "symptomDiscussions", id);
    const discussionSnap = await getDoc(discussionDocRef);

    if (!discussionSnap.exists()) {
        return null;
    }

    const discussionData = discussionSnap.data() as SymptomDiscussion;
    discussionData.id = discussionSnap.id;

    const postsCollection = collection(firestore, "symptomDiscussions", id, "posts");
    const postsSnapshot = await getDocs(query(postsCollection, orderBy("createdAt", "asc")));
    const posts = postsSnapshot.docs.map(postDoc => ({
        id: postDoc.id,
        ...postDoc.data()
    })) as DiscussionPost[];

    return { discussion: discussionData, posts };
}

export default async function DiscussionDetailsPage({ params }: { params: { id:string } }) {
    const data = await getDiscussionDetails(params.id);

    if (!data) {
        notFound();
    }

    const { discussion, posts } = data;

    return (
        <div className="space-y-6">
            <header>
                <Button asChild variant="outline" size="sm">
                    <Link href="/community/discussions">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to All Discussions
                    </Link>
                </Button>
            </header>

            <Card>
                <CardHeader>
                    <div className="flex flex-wrap gap-2 mb-2">
                        {discussion.tags.map(tag => (
                            <Badge key={tag} variant="secondary">{tag}</Badge>
                        ))}
                    </div>
                    <CardTitle className="text-2xl">{discussion.title}</CardTitle>
                    <CardDescription>
                        Started by <span className="font-semibold">{discussion.author}</span> on {format((discussion.createdAt as Timestamp).toDate(), "PPP")}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-foreground whitespace-pre-wrap">{discussion.description}</p>
                </CardContent>
            </Card>

            <div className="space-y-4">
                <h2 className="text-xl font-bold">{posts.length} Replies</h2>
                {posts.map((post, index) => (
                    <Card key={post.id} className="bg-muted/30">
                        <CardHeader className="pb-2 flex-row justify-between items-start">
                           <div>
                             <CardDescription className="flex items-center">
                                <UserCircle className="mr-2 h-5 w-5" />
                                <span className="font-semibold text-foreground">{post.author}</span>
                            </CardDescription>
                            <CardDescription className="text-xs pl-7">
                                {format((post.createdAt as Timestamp).toDate(), "PPpp")}
                            </CardDescription>
                           </div>
                            <Button variant="outline" size="sm" disabled>
                                <ThumbsUp className="mr-2 h-4 w-4"/> Top Answer
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <p className="whitespace-pre-wrap">{post.text}</p>
                        </CardContent>
                        <CardFooter>
                            <Button variant="ghost" size="sm" className="text-muted-foreground" disabled>
                                <ThumbsUp className="mr-2 h-4 w-4" /> ({post.upvotes}) Helpful
                            </Button>
                        </CardFooter>
                    </Card>
                ))}
                {posts.length === 0 && (
                    <p className="text-muted-foreground">Be the first to reply to this discussion.</p>
                )}
            </div>

            <Separator />
            
            <div>
                <h3 className="text-lg font-semibold mb-2">Join the Conversation</h3>
                <ReplyForm discussionId={discussion.id} />
            </div>
        </div>
    );
}
